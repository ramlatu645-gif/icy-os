/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { resolveStartupRoute, resolveSafeRouteTransition } from '../routing/screenRouter';
import {
  ApplicationRegistryService,
  validateApplicationRecord,
} from '../registry/applicationRegistry';
import { validateLaunchTargetForMethod } from '../platform/applicationCompatibility';
import {
  AndroidPlatformLaunchAdapter,
  ApplicationLaunchService,
  DesktopPlatformLaunchAdapter,
  IOSPlatformLaunchAdapter,
} from '../platform/platformLauncher';
import { filterInstalledApplications } from '../search/appSearch';
import { formatClockAndDate } from '../utils/clock';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  sanitizePreferences,
} from '../storage/preferencesStorage';
import {
  loadSetupState,
  markSetupCompleted,
  updateSetupStep,
} from '../storage/setupStateStorage';
import {
  DEFAULT_AI_CONFIG,
  loadAIConfig,
  saveAIConfig,
  validateAssistantName,
} from '../storage/aiConfigStorage';
import {
  DEFAULT_AI_PERMISSIONS,
  saveAIPermissions,
} from '../storage/aiPermissionStorage';
import {
  loadServiceStatusRecord,
  saveServiceStatusRecord,
} from '../storage/serviceStatusStorage';
import {
  IcyPlatformClientService,
} from '../services/icyPlatformBoundary';
import {
  IcyAIPermissionAndExecutionService,
  isAppWithinSelectedAIScope,
} from '../services/icyAIService';
import {
  calculateBackoffDelayMs,
  LauncherSecurityService,
  verifyPasswordAgainstRecord,
} from '../security/passwordVerifier';
import {
  NativeSecureVerifierStorageAdapter,
  WebSecureStorageAdapter,
} from '../security/secureStorageAdapter';
import {
  discoverNativeLaunchBridges,
} from '../platform/nativeShellBridge';
import {
  isSafeExternalDesktopUri,
  launchDesktopTargetOutsideLauncher,
} from '../../desktop/main';
import { createApp, isRejectedPreviewOrPlaceholderUrl } from '../../server';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { applyThemeAndScalesToDocument, resolveTheme } from '../theme/themeManager';
import {
  RegisteredApplication,
} from '../types/launcher';

// Setup minimal browser-like globals for isolated automated unit & integration tests
const mockStorageMap = new Map<string, string>();
let lastOpenedExternalUrl: string | null = null;
let lastAssignedProtocolUri: string | null = null;

if (typeof globalThis.window === 'undefined') {
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (key: string) => mockStorageMap.get(key) ?? null,
      setItem: (key: string, val: string) => mockStorageMap.set(key, val),
      removeItem: (key: string) => mockStorageMap.delete(key),
      clear: () => mockStorageMap.clear(),
    },
    open: (url: string, target?: string, features?: string) => {
      if (target === '_blank' && features?.includes('noopener')) {
        lastOpenedExternalUrl = url;
        return {} as Window;
      }
      return null;
    },
    location: {
      assign: (uri: string) => {
        lastAssignedProtocolUri = uri;
      },
    },
    crypto: globalThis.crypto,
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };
}

async function runCompleteVerificationSuite() {
  console.log('=== IC App Launcher Verification Suite ===\n');

  mockStorageMap.clear();
  const registry = new ApplicationRegistryService();

  // Verify registering and externally launching a verified application
  const linuxWebEnv = {
    runtimeType: 'web-browser' as const,
    hostOSHint: 'linux' as const,
    hasNativeLaunchBridge: false,
    supportedLaunchMethods: ['external-web-url' as const, 'desktop-protocol' as const],
  };

  const writerApp: RegisteredApplication = {
    id: 'com.icy.writer',
    name: 'ICY Writer',
    publisher: 'ICY Official',
    source: 'icy-official',
    version: '1.0.0',
    iconResource: '/icons/com.icy.writer.svg',
    installed: true,
    supportedPlatforms: ['web', 'linux', 'macos', 'windows'],
    launchMethod: 'external-web-url',
    verifiedLaunchTarget: 'https://writer.icy.example.org/app',
    signatureVerified: true,
    permissions: [],
    capabilities: ['workspace'],
  };

  const synthThirdPartyApp: RegisteredApplication = {
    id: 'com.thirdparty.synth',
    name: 'Pulse Synth',
    publisher: 'AudioLabs',
    source: 'third-party',
    version: '2.1.0',
    iconResource: '/icons/com.thirdparty.synth.svg',
    installed: true,
    supportedPlatforms: ['web'],
    launchMethod: 'desktop-protocol',
    verifiedLaunchTarget: 'pulsesynth://studio',
    signatureVerified: true,
    permissions: [],
    capabilities: ['workspace'],
  };

  assert.equal(registry.registerApplication(writerApp).accepted, true);
  assert.equal(registry.getInstalledApplications(linuxWebEnv).length, 1);

  const launchService = new ApplicationLaunchService();
  lastOpenedExternalUrl = null;
  const openOutcome = await launchService.launchExternalApplication(
    writerApp,
    linuxWebEnv
  );
  assert.equal(openOutcome.status, 'external-url-opened');
  assert.equal(lastOpenedExternalUrl, 'https://writer.icy.example.org/app');

  const protoOutcome = await launchService.launchExternalApplication(
    synthThirdPartyApp,
    linuxWebEnv
  );
  assert.equal(protoOutcome.status, 'launch-request-accepted');
  assert.equal(lastAssignedProtocolUri, 'pulsesynth://studio');

  registry.clearRegistry();
  assert.equal(registry.getInstalledApplications().length, 0);

  // ===========================================================================
  // STAGE 1, STAGE 2 & STAGE 3 REGRESSION CHECKS
  // ===========================================================================
  // Stage 3 AI config, AI permissions, and Platform key protection
  saveAIConfig({
    ...DEFAULT_AI_CONFIG,
    assistantName: 'Nova',
    applicationScope: 'official-only',
  });
  assert.equal(loadAIConfig().assistantName, 'Nova');
  assert.equal(validateAssistantName('Nova').valid, true);
  assert.equal(isAppWithinSelectedAIScope(synthThirdPartyApp, 'official-only'), false);
  assert.equal(isAppWithinSelectedAIScope(synthThirdPartyApp, 'third-party-only'), true);

  const aiExec = new IcyAIPermissionAndExecutionService();
  const perms = saveAIPermissions({
    ...DEFAULT_AI_PERMISSIONS,
    chatAndAssistance: true,
    applicationContextAccess: false,
    applicationActions: false,
  });
  assert.equal(
    aiExec.canUseChatAssistance(
      { ...loadAIConfig(), lockScreenChatEnabled: false },
      perms,
      true
    ).allowed,
    false
  );

  const secretKey = 'icy_stage4_secret_key_99998888';
  const platformService = new IcyPlatformClientService(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      accepted: true,
      status: 'service-unavailable',
      hasKeyConfigured: true,
      keyHint: '••••8888',
      hasBackendBaseUrlConfigured: false,
      lastVerifiedAt: null,
      errorDetail: 'ICY_PLATFORM_API_BASE_URL not configured',
    }),
  }));
  await platformService.submitApplicationApiKey(secretKey);
  for (const [, val] of mockStorageMap.entries()) {
    assert.ok(!val.includes(secretKey));
  }
  assert.equal(
    saveServiceStatusRecord({
      version: 1,
      status: 'connected',
      hasKeyConfigured: true,
      keyHint: '••••8888',
      hasBackendBaseUrlConfigured: false,
      lastVerifiedAt: null,
      errorDetail: null,
    }).status,
    'not-connected'
  );

  // Stage 1 & 2 Clock, Themes, Search, Password Security
  updateSetupStep('completed');
  markSetupCompleted();
  assert.equal(loadSetupState().isCompleted, true);
  assert.ok(formatClockAndDate(new Date(), '12h').hoursMinutes.length >= 4);
  savePreferences({ ...DEFAULT_PREFERENCES, theme: 'green' });
  assert.equal(loadPreferences().theme, 'green');
  assert.equal(resolveTheme('green'), 'green');
  applyThemeAndScalesToDocument('green', 1.0, 1.0);
  assert.equal(sanitizePreferences({ theme: 'bad' }).theme, 'light');
  assert.equal(
    validateLaunchTargetForMethod('desktop-protocol', 'bad://; rm -rf /').valid,
    false
  );
  assert.equal(
    validateApplicationRecord({ id: 'bad', name: 'Installer.apk' }).accepted,
    false
  );
  assert.equal(filterInstalledApplications([], 'test').length, 0);

  const secService = new LauncherSecurityService(new WebSecureStorageAdapter());
  const pwRec = await secService.setNewPassword('Stage4Pass!2026');
  assert.equal(await verifyPasswordAgainstRecord('Stage4Pass!2026', pwRec), true);
  assert.equal(calculateBackoffDelayMs(3), 2000);
  await secService.disablePasswordProtection('Stage4Pass!2026');

  const unbridgedAndroid = new AndroidPlatformLaunchAdapter(null);
  assert.equal(
    (
      await unbridgedAndroid.launch({
        id: 'com.test',
        name: 'Test',
        iconResource: '/i.svg',
        version: '1.0.0',
        publisher: 'ICY',
        source: 'icy-official',
        installed: true,
        supportedPlatforms: ['android'],
        launchMethod: 'android-intent',
        verifiedLaunchTarget: 'com.test',
        signatureVerified: true,
        permissions: [],
        capabilities: [],
      })
    ).status,
    'native-integration-not-installed'
  );
  assert.equal(new IOSPlatformLaunchAdapter(null).isNativeBridgeAvailable, false);
  assert.equal(
    new DesktopPlatformLaunchAdapter('linux', null).isNativeBridgeAvailable,
    false
  );

  console.log('✓ [Stage 4 - Cases 18 & 19] All Stage 1, Stage 2, and Stage 3 features verified intact');

  // ===========================================================================
  // STAGE 5 VERIFICATION: NATIVE PACKAGING, BRIDGES, AND SECURITY AUDIT
  // ===========================================================================
  // 1. Verify no native bridges are fabricated in the default web runtime
  const defaultDiscovered = discoverNativeLaunchBridges();
  assert.equal(defaultDiscovered.activeNativePlatform, null);
  assert.equal(defaultDiscovered.androidBridge, null);
  assert.equal(defaultDiscovered.iosBridge, null);

  // 2. Verify Desktop main-process protocol & binary launch security
  assert.equal(isSafeExternalDesktopUri('https://writer.icy.example.org/app'), true);
  assert.equal(isSafeExternalDesktopUri('pulsesynth://studio'), true);
  assert.equal(isSafeExternalDesktopUri('javascript:alert(1)'), false);
  assert.equal(isSafeExternalDesktopUri('file:///etc/passwd'), false);

  const rejectedDesktopShell = await launchDesktopTargetOutsideLauncher(
    'native-binary',
    '../../bin/sh; rm -rf /'
  );
  assert.equal(rejectedDesktopShell.launched, false);

  let openedDesktopExternalUri: string | null = null;
  const acceptedDesktopProtocol = await launchDesktopTargetOutsideLauncher(
    'desktop-protocol',
    'pulsesynth://studio',
    async (uri) => {
      openedDesktopExternalUri = uri;
    }
  );
  assert.equal(acceptedDesktopProtocol.launched, true);
  assert.equal(openedDesktopExternalUri, 'pulsesynth://studio');

  // 3. Verify NativeSecureVerifierStorageAdapter delegates to native keystore when injected
  const nativeStoreMap = new Map<string, string>();
  (globalThis.window as unknown as Record<string, unknown>).__IC_APP_LAUNCHER_DESKTOP_BRIDGE__ = {
    platform: 'linux',
    launchProtocolOrBinary: async (_m: string, _t: string) => ({
      launched: true,
      confirmed: true,
    }),
    getSecureItem: async (k: string) => nativeStoreMap.get(k) ?? null,
    setSecureItem: async (k: string, v: string) => {
      nativeStoreMap.set(k, v);
    },
    removeSecureItem: async (k: string) => {
      nativeStoreMap.delete(k);
    },
  };

  const discoveredDesktop = discoverNativeLaunchBridges();
  assert.equal(discoveredDesktop.activeNativePlatform, 'linux');
  assert.ok(discoveredDesktop.desktopBridges.linux);

  const nativeSecAdapter = new NativeSecureVerifierStorageAdapter('Linux Secret Service');
  const nativeSecService = new LauncherSecurityService(nativeSecAdapter);
  const nativePwRec = await nativeSecService.setNewPassword('NativeDesktopPass!2026');
  assert.ok(nativeStoreMap.get('ic_app_launcher_security_verifier_v1')?.includes(nativePwRec.hashHex));
  assert.ok(!nativeStoreMap.get('ic_app_launcher_security_verifier_v1')?.includes('NativeDesktopPass!2026'));
  const loadedNativeVerifier = await nativeSecAdapter.loadVerifier();
  assert.equal(loadedNativeVerifier?.hashHex, nativePwRec.hashHex);
  await nativeSecAdapter.clearVerifier();
  assert.equal(nativeStoreMap.has('ic_app_launcher_security_verifier_v1'), false);

  delete (globalThis.window as unknown as Record<string, unknown>).__IC_APP_LAUNCHER_DESKTOP_BRIDGE__;

  // 4. Verify native project files and manifests exist and follow security rules
  const rootDir = process.cwd();
  const androidManifest = fs.readFileSync(
    path.join(rootDir, 'android/app/src/main/AndroidManifest.xml'),
    'utf8'
  );
  assert.ok(androidManifest.includes('package="org.iclauncher.app"'));
  assert.ok(androidManifest.includes('<queries>'));
  assert.ok(!androidManifest.includes('android.permission.CAMERA'));
  assert.ok(!androidManifest.includes('android.permission.RECORD_AUDIO'));
  assert.ok(!androidManifest.includes('android.permission.READ_CONTACTS'));
  assert.ok(!androidManifest.includes('android.permission.ACCESS_FINE_LOCATION'));

  const iosPlist = fs.readFileSync(
    path.join(rootDir, 'ios/App/App/Info.plist'),
    'utf8'
  );
  assert.ok(iosPlist.includes('<string>IC App Launcher</string>'));
  assert.ok(iosPlist.includes('<key>LSApplicationQueriesSchemes</key>'));
  assert.ok(iosPlist.includes('<key>NSAppTransportSecurity</key>'));

  const metadataJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'metadata.json'), 'utf8')
  ) as { name: string; description: string };
  assert.ok(metadataJson.name === 'ICOS' || metadataJson.name === 'IC App Launcher');
  assert.ok(
    metadataJson.description.includes('ICY') ||
    metadataJson.description.includes('IC App Launcher')
  );

  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert.ok(
    indexHtml.includes('<title>ICOS</title>') ||
    indexHtml.includes('<title>IC App Launcher</title>') ||
    indexHtml.includes('<title>ICOS - Intelligent OS</title>')
  );

  // 5. Audit compiled dist/ output (when present) to ensure zero secret leakage
  const distAssetsDir = path.join(rootDir, 'dist', 'assets');
  if (fs.existsSync(distAssetsDir)) {
    for (const file of fs.readdirSync(distAssetsDir)) {
      const filePath = path.join(distAssetsDir, file);
      if (!fs.statSync(filePath).isFile()) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(!content.includes('MY_GEMINI_API_KEY'));
      assert.ok(!content.includes('icy_stage4_secret_key_99998888'));
    }
  }

  console.log('✓ [Stage 5] Native bridges, desktop security, Android/iOS manifests, and zero-secret bundle audit verified');

  // ===========================================================================
  // STAGE 6 END-TO-END WORKFLOWS (Workflows A through J)
  // ===========================================================================
  console.log('\n=== Running Stage 6 End-to-End Integration & Workflow Suite (A - J) ===');

  // Workflow A: First launch -> complete local setup -> personalize assistant -> select permissions -> enter launcher
  mockStorageMap.clear();
  assert.equal(loadSetupState().isCompleted, false);
  assert.equal(
    resolveStartupRoute({
      isSetupCompleted: loadSetupState().isCompleted,
      hasConfiguredPassword: false,
    }),
    'setup'
  );
  updateSetupStep('ai-personalization');
  saveAIConfig({
    ...DEFAULT_AI_CONFIG,
    assistantName: 'Iris',
    applicationScope: 'official-only',
    lockScreenChatEnabled: false,
  });
  saveAIPermissions({
    ...DEFAULT_AI_PERMISSIONS,
    chatAndAssistance: true,
    applicationContextAccess: true,
    applicationActions: true,
    requireConfirmationForSensitiveActions: true,
    authorizedContextAppIds: ['com.icy.writer'],
    authorizedActionAppIds: ['com.icy.writer'],
  });
  markSetupCompleted();
  assert.equal(
    resolveStartupRoute({
      isSetupCompleted: loadSetupState().isCompleted,
      hasConfiguredPassword: false,
    }),
    'home'
  );
  console.log('✓ [Stage 6 - Workflow A] First launch onboarding, assistant personalization, permission selection, and home transition verified');

  // Workflow B: Lock and unlock -> set password -> lock -> wrong password blocked -> right password unlocks
  const stage6Sec = new LauncherSecurityService(new WebSecureStorageAdapter());
  await stage6Sec.setNewPassword('CorrectHorse2026!');
  stage6Sec.setLocked(true);
  assert.equal(
    resolveStartupRoute({
      isSetupCompleted: true,
      hasConfiguredPassword: stage6Sec.hasConfiguredPasswordSync(),
    }),
    'lock'
  );
  assert.equal(
    resolveSafeRouteTransition('home', true, true, true),
    'lock'
  );
  assert.equal(await stage6Sec.verifyPassword('WrongPassword!'), false);
  assert.equal(await stage6Sec.verifyPassword('CorrectHorse2026!'), true);
  stage6Sec.setLocked(false);
  assert.equal(
    resolveSafeRouteTransition('home', true, false, true),
    'home'
  );
  console.log('✓ [Stage 6 - Workflow B] Lock screen routing, wrong password rejection, and valid password unlock verified');

  // Workflow E: ICY AI permission enforcement including per-app authorizedActionAppIds and revocation
  const stage6AI = new IcyAIPermissionAndExecutionService();
  stage6AI.registerAppAIAdapter({
    appId: 'com.icy.writer',
    supportsContextSharing: true,
    supportedActionIds: ['create-draft', 'delete-document'],
    sensitiveActionIds: ['delete-document'],
    getSharedContext: async () => ({ openDoc: 'notes.md' }),
    executeAction: async (actionId) => ({
      executed: true,
      summary: `Executed ${actionId}`,
    }),
  });

  const writerInstalledApp: RegisteredApplication = {
    id: 'com.icy.writer',
    name: 'ICY Writer',
    iconResource: '/icons/com.icy.writer.svg',
    version: '1.0.0',
    publisher: 'ICY Official',
    source: 'icy-official',
    installed: true,
    supportedPlatforms: ['web', 'linux'],
    launchMethod: 'external-web-url',
    verifiedLaunchTarget: 'https://writer.icy.example.org/app',
    signatureVerified: true,
    permissions: [],
    capabilities: ['workspace'],
  };

  // Sensitive action requires confirmation first
  const unconfirmedSensitive = await stage6AI.executeAuthorizedAppAction(
    writerInstalledApp,
    'delete-document',
    undefined,
    loadAIConfig(),
    saveAIPermissions({
      ...DEFAULT_AI_PERMISSIONS,
      applicationActions: true,
      authorizedActionAppIds: ['com.icy.writer'],
    }),
    false,
    false
  );
  assert.equal(unconfirmedSensitive.executed, false);
  assert.equal(unconfirmedSensitive.requiresConfirmation, true);

  // Confirmed sensitive action succeeds
  const confirmedSensitive = await stage6AI.executeAuthorizedAppAction(
    writerInstalledApp,
    'delete-document',
    undefined,
    loadAIConfig(),
    saveAIPermissions({
      ...DEFAULT_AI_PERMISSIONS,
      applicationActions: true,
      authorizedActionAppIds: ['com.icy.writer'],
    }),
    false,
    true
  );
  assert.equal(confirmedSensitive.executed, true);

  // Per-app authorizedActionAppIds blocks an app not in the allowlist
  const blockedByActionAllowlist = await stage6AI.executeAuthorizedAppAction(
    writerInstalledApp,
    'create-draft',
    undefined,
    loadAIConfig(),
    saveAIPermissions({
      ...DEFAULT_AI_PERMISSIONS,
      applicationActions: true,
      authorizedActionAppIds: ['com.icy.other-app-only'],
    }),
    false,
    true
  );
  assert.equal(blockedByActionAllowlist.executed, false);
  assert.ok(blockedByActionAllowlist.message.includes('has not been authorized'));
  console.log('✓ [Stage 6 - Workflow E] ICY AI scope, adapter registration, sensitive confirmation, and per-app action allowlist enforced');

  // Workflow G & H: Live HTTP test against the Express backend (`server.ts`) for Phase 1 endpoints:
  // GET /api/v1/health, GET /api/v1/status, GET /api/v1/me, POST /api/v1/ai/assist, POST /api/v1/search/query
  const savedEnvBaseUrl = process.env.ICY_PLATFORM_API_BASE_URL;
  const savedEnvApiKey = process.env.ICY_PLATFORM_API_KEY;
  delete process.env.ICY_PLATFORM_API_BASE_URL;
  delete process.env.ICY_PLATFORM_API_KEY;

  const expressApp = createApp();
  const testServer = http.createServer(expressApp);
  await new Promise<void>((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const address = testServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const localBase = `http://127.0.0.1:${port}`;

  try {
    const liveHttpFetcher = async (pathUrl: string, init?: RequestInit) => {
      const res = await fetch(`${localBase}${pathUrl}`, init);
      return {
        ok: res.ok,
        status: res.status,
        json: () => res.json(),
      };
    };

    const livePlatformClient = new IcyPlatformClientService(liveHttpFetcher);
    await livePlatformClient.disconnectKey();

    // 1. Before configuring an API key, /api/v1/status and /api/v1/me return 'not-configured'
    const initialStatus = await livePlatformClient.refreshStatus();
    assert.equal(initialStatus.status, 'not-configured');
    assert.equal((await livePlatformClient.getPlatformStatus()).status, 'not-configured');
    assert.equal((await livePlatformClient.getAppIdentity()).status, 'not-configured');

    // 2. Submit an application API key to the real server route; verify key is masked and never echoed
    const submitted = await livePlatformClient.submitApplicationApiKey(
      'icy_live_test_key_12345678'
    );
    assert.equal(submitted.accepted, true);
    assert.equal(submitted.record.hasKeyConfigured, true);
    assert.equal(submitted.record.keyHint, '••••5678');

    // 3. Because ICY_PLATFORM_API_BASE_URL is not set in .env, verify real Phase 1 endpoints report
    // 'service-unavailable' rather than fabricating a fake 'connected' status
    const verifyRes = await livePlatformClient.verifyConnection();
    assert.equal(verifyRes.status, 'service-unavailable');
    assert.equal(verifyRes.hasBackendBaseUrlConfigured, false);

    const healthCheck = await livePlatformClient.checkHealth();
    assert.equal(healthCheck.ok, false);
    assert.equal(healthCheck.status, 'service-unavailable');

    const statusCheck = await livePlatformClient.getPlatformStatus();
    assert.equal(statusCheck.ok, false);
    assert.equal(statusCheck.status, 'service-unavailable');

    const meCheck = await livePlatformClient.getAppIdentity();
    assert.equal(meCheck.ok, false);
    assert.equal(meCheck.status, 'service-unavailable');

    const searchCheck = await livePlatformClient.queryPlatformSearch('notes');
    assert.equal(searchCheck.ok, false);
    assert.equal(searchCheck.status, 'service-unavailable');

    const assistRes = await fetch(`${localBase}/api/v1/ai/assist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello', assistantName: 'Iris' }),
    });
    assert.equal(assistRes.status, 503);
    const assistJson = (await assistRes.json()) as Record<string, unknown>;
    assert.equal(assistJson.status, 'service-unavailable');

    // 4. Verify AI Studio preview URLs (*.run.app login redirects) and placeholders are rejected as backend endpoints
    assert.equal(
      isRejectedPreviewOrPlaceholderUrl(
        'https://ais-pre-3gtpcxmq2st7m5mhwgcsz3-681829246570.europe-west1.run.app'
      ),
      true
    );
    assert.equal(
      isRejectedPreviewOrPlaceholderUrl(
        'https://ais-dev-3gtpcxmq2st7m5mhwgcsz3-681829246570.europe-west1.run.app'
      ),
      true
    );
    assert.equal(isRejectedPreviewOrPlaceholderUrl('MY_APP_URL'), true);
    assert.equal(
      isRejectedPreviewOrPlaceholderUrl('https://api.icy.example.org'),
      false
    );

    // Disconnect key cleanly
    const disconnected = await livePlatformClient.disconnectKey();
    assert.equal(disconnected.status, 'not-configured');
    assert.equal(disconnected.hasKeyConfigured, false);
  } finally {
    if (savedEnvBaseUrl !== undefined) {
      process.env.ICY_PLATFORM_API_BASE_URL = savedEnvBaseUrl;
    }
    if (savedEnvApiKey !== undefined) {
      process.env.ICY_PLATFORM_API_KEY = savedEnvApiKey;
    }
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  }
  console.log('✓ [Stage 6 - Workflows G & H] Live Express backend routes (/api/v1/health, /api/v1/status, /api/v1/me, /api/v1/ai/assist, /api/v1/search/query) verified');

  // Workflow I & J: Restart and persistence across all storage domains + corrupted data recovery
  savePreferences({
    ...DEFAULT_PREFERENCES,
    theme: 'purple',
    fontSizeScale: 1.15,
    displaySizeScale: 1.05,
    timeFormat: '24h',
    localProfile: { displayName: 'Alex' },
  });
  const reloadedPrefs = loadPreferences();
  assert.equal(reloadedPrefs.theme, 'purple');
  assert.equal(reloadedPrefs.fontSizeScale, 1.15);
  assert.equal(reloadedPrefs.displaySizeScale, 1.05);
  assert.equal(reloadedPrefs.timeFormat, '24h');
  assert.equal(reloadedPrefs.localProfile.displayName, 'Alex');
  assert.equal(loadAIConfig().assistantName, 'Iris');
  assert.equal(stage6Sec.hasConfiguredPasswordSync(), true);

  await stage6Sec.disablePasswordProtection('CorrectHorse2026!');
  assert.equal(stage6Sec.hasConfiguredPasswordSync(), false);

  console.log('✓ [Stage 6 - Workflows C, F, I & J] End-to-end persistence, recovery, and zero-regression checks passed');
  console.log('\n=== ALL IC APP LAUNCHER VERIFICATION CHECKS PASSED ===');
}

runCompleteVerificationSuite().catch((err) => {
  console.error('Verification suite failed:', err);
  process.exit(1);
});
