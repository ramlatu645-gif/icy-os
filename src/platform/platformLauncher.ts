/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LaunchMethod,
  LaunchOutcomeStatus,
  LaunchResult,
  RegisteredApplication,
  SupportedPlatform,
} from '../types/launcher';
import {
  applicationCompatibilityService,
  ApplicationCompatibilityService,
  RuntimeEnvironmentDescriptor,
  validateLaunchTargetForMethod,
} from './applicationCompatibility';
import { discoverNativeLaunchBridges } from './nativeShellBridge';

export interface PlatformCapabilitiesReport {
  detectedRuntime: 'web-browser-preview' | 'native-shell';
  hostOSHint: SupportedPlatform;
  canEnumerateArbitrarySystemApps: boolean;
  supportedLaunchMethods: LaunchMethod[];
  limitationsNote: string;
}

/**
 * PlatformLaunchAdapter interface.
 * Separates launcher UI and service orchestration from operating-system-specific
 * external launching behavior.
 */
export interface PlatformLaunchAdapter {
  readonly adapterId: string;
  readonly targetPlatform: SupportedPlatform;
  readonly isNativeBridgeAvailable: boolean;
  getCapabilities(): PlatformCapabilitiesReport;
  canHandleLaunchMethod(method: LaunchMethod): boolean;
  launch(app: RegisteredApplication): Promise<LaunchResult>;
}

function createLaunchResult(
  app: Pick<RegisteredApplication, 'id' | 'name'>,
  status: LaunchOutcomeStatus,
  initiated: boolean,
  confirmedByPlatform: boolean,
  userMessage: string,
  technicalReason?: string
): LaunchResult {
  return {
    status,
    appId: app.id,
    appName: app.name,
    initiated,
    confirmedByPlatform,
    userMessage,
    technicalReason,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Browser / Web Preview Launch Adapter.
 *
 * Genuinely works in the browser and AI Studio preview environment:
 * - Opens verified external web URLs (`https://` / `http://`) and iOS Universal Links
 *   in a separate external browser tab/window (`noopener,noreferrer`) so the app runs
 *   outside IC App Launcher while IC App Launcher remains open and functional for the user to return to.
 * - Hands off registered custom protocols (`desktop-protocol`, `ios-url-scheme`) to the
 *   host operating system's protocol handler and accurately reports `launch-request-accepted`
 *   (because browsers do not confirm whether the OS completed opening the native app).
 * - Reports `native-integration-not-installed` for `android-intent` and `native-binary`
 *   targets rather than pretending a web browser can execute native binaries or Android intents.
 */
export class BrowserPlatformLaunchAdapter implements PlatformLaunchAdapter {
  public readonly adapterId = 'web-browser-launch-adapter';
  public readonly targetPlatform: SupportedPlatform = 'web';
  public readonly isNativeBridgeAvailable = false;

  private externalWindowOpener: (url: string) => boolean;
  private protocolAssigner: (uri: string) => void;

  constructor(options?: {
    externalWindowOpener?: (url: string) => boolean;
    protocolAssigner?: (uri: string) => void;
  }) {
    this.externalWindowOpener =
      options?.externalWindowOpener ??
      ((url: string) => {
        if (typeof window === 'undefined') return false;
        // Open external web application in a separate browser context/tab
        // Never embed inside an iframe or internal launcher container.
        if (typeof window.open === 'function') {
          const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
          if (openedWindow !== null) {
            return true;
          }
        }
        // Fallback: anchor click with target="_blank" and rel="noopener noreferrer"
        if (typeof document !== 'undefined') {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          return true;
        }
        return false;
      });

    this.protocolAssigner =
      options?.protocolAssigner ??
      ((uri: string) => {
        if (typeof window !== 'undefined' && window.location) {
          window.location.assign(uri);
        }
      });
  }

  public getCapabilities(): PlatformCapabilitiesReport {
    const hostOSHint = applicationCompatibilityService.detectHostOSHint();
    return {
      detectedRuntime: 'web-browser-preview',
      hostOSHint,
      canEnumerateArbitrarySystemApps: false,
      supportedLaunchMethods: [
        'external-web-url',
        'ios-universal-link',
        'desktop-protocol',
        'ios-url-scheme',
      ],
      limitationsNote:
        'Running in web browser runtime. External web apps open in a separate browser tab/window, and registered custom protocols are handed off to the OS without OS-level completion confirmation. Native Android package intents and desktop binary execution require native packaging.',
    };
  }

  public canHandleLaunchMethod(method: LaunchMethod): boolean {
    return (
      method === 'external-web-url' ||
      method === 'ios-universal-link' ||
      method === 'desktop-protocol' ||
      method === 'ios-url-scheme'
    );
  }

  public async launch(app: RegisteredApplication): Promise<LaunchResult> {
    if (
      app.launchMethod === 'android-intent' ||
      app.launchMethod === 'native-binary'
    ) {
      return createLaunchResult(
        app,
        'native-integration-not-installed',
        false,
        false,
        `Cannot launch "${app.name}" in the web preview because it requires the native ${
          app.launchMethod === 'android-intent' ? 'Android Intent' : 'desktop process'
        } bridge.`,
        `Launch method "${app.launchMethod}" is not supported by BrowserPlatformLaunchAdapter.`
      );
    }

    if (
      app.launchMethod === 'external-web-url' ||
      app.launchMethod === 'ios-universal-link'
    ) {
      try {
        const opened = this.externalWindowOpener(app.verifiedLaunchTarget);
        if (!opened) {
          return createLaunchResult(
            app,
            'launch-request-failed',
            false,
            false,
            `Could not open "${app.name}" externally. Check whether your browser blocked the external window.`,
            'External window opener returned false.'
          );
        }
        return createLaunchResult(
          app,
          'external-url-opened',
          true,
          false,
          `Opened "${app.name}" in an external browser window.`,
          `Target URL opened externally: ${app.verifiedLaunchTarget}`
        );
      } catch (err) {
        return createLaunchResult(
          app,
          'launch-request-failed',
          false,
          false,
          `Failed to open "${app.name}" externally.`,
          err instanceof Error ? err.message : 'Unknown browser error'
        );
      }
    }

    if (
      app.launchMethod === 'desktop-protocol' ||
      app.launchMethod === 'ios-url-scheme'
    ) {
      try {
        this.protocolAssigner(app.verifiedLaunchTarget);
        // Accurate reporting: the browser hands the custom protocol request to the OS,
        // but the OS does not report back to the browser whether the external app finished launching.
        return createLaunchResult(
          app,
          'launch-request-accepted',
          true,
          false,
          `Launch request for "${app.name}" was sent to your device's operating system.`,
          `Custom protocol handed off to OS: ${app.verifiedLaunchTarget}. OS does not expose launch completion confirmation to web runtimes.`
        );
      } catch (err) {
        return createLaunchResult(
          app,
          'launch-request-failed',
          false,
          false,
          `Failed to hand off "${app.name}" protocol request to the operating system.`,
          err instanceof Error ? err.message : 'Protocol dispatch error'
        );
      }
    }

    return createLaunchResult(
      app,
      'unsupported-platform',
      false,
      false,
      `"${app.name}" uses a launch method not supported on this platform.`,
      `Unhandled launch method: ${String(app.launchMethod)}`
    );
  }
}

/**
 * Native Bridge Contracts for Packaged Targets (Android, iOS/iPadOS, Windows, macOS, Linux).
 * These adapters delegate to a real native shell bridge ONLY when that bridge is genuinely
 * injected by the packaged native runtime. When no native bridge is present, they accurately
 * report `native-integration-not-installed` and never fabricate a successful launch.
 */
export interface NativeAndroidBridge {
  launchPackageIntent(packageId: string, intentUri?: string): Promise<{
    launched: boolean;
    confirmed: boolean;
    errorReason?: string;
  }>;
}

export class AndroidPlatformLaunchAdapter implements PlatformLaunchAdapter {
  public readonly adapterId = 'android-native-launch-adapter';
  public readonly targetPlatform: SupportedPlatform = 'android';
  private bridge: NativeAndroidBridge | null;

  constructor(bridge: NativeAndroidBridge | null = null) {
    this.bridge = bridge;
  }

  public get isNativeBridgeAvailable(): boolean {
    return this.bridge !== null;
  }

  public getCapabilities(): PlatformCapabilitiesReport {
    return {
      detectedRuntime: this.bridge ? 'native-shell' : 'web-browser-preview',
      hostOSHint: 'android',
      canEnumerateArbitrarySystemApps: false,
      supportedLaunchMethods: ['android-intent', 'external-web-url'],
      limitationsNote:
        'Android 11+ (API 30+) package visibility restrictions require explicit <queries> declarations in AndroidManifest.xml for target packages.',
    };
  }

  public canHandleLaunchMethod(method: LaunchMethod): boolean {
    return method === 'android-intent' || method === 'external-web-url';
  }

  public async launch(app: RegisteredApplication): Promise<LaunchResult> {
    if (!this.bridge) {
      return createLaunchResult(
        app,
        'native-integration-not-installed',
        false,
        false,
        `Cannot launch Android package "${app.name}" because the native Android launcher bridge is not installed in this environment.`,
        'NativeAndroidBridge is not present.'
      );
    }

    try {
      const pkg = app.nativePackageId || app.verifiedLaunchTarget;
      const res = await this.bridge.launchPackageIntent(pkg, app.verifiedLaunchTarget);
      if (!res.launched) {
        return createLaunchResult(
          app,
          'target-application-unavailable',
          false,
          false,
          `Could not open "${app.name}". Ensure the Android app is installed and declared in package visibility queries.`,
          res.errorReason
        );
      }
      return createLaunchResult(
        app,
        res.confirmed ? 'native-launch-confirmed' : 'launch-request-accepted',
        true,
        res.confirmed,
        `Opened "${app.name}" via Android system intent.`
      );
    } catch (err) {
      return createLaunchResult(
        app,
        'launch-request-failed',
        false,
        false,
        `Android failed to launch "${app.name}".`,
        err instanceof Error ? err.message : 'Android intent error'
      );
    }
  }
}

export interface NativeIOSBridge {
  openUniversalLinkOrScheme(url: string): Promise<{
    opened: boolean;
    confirmed: boolean;
    errorReason?: string;
  }>;
}

export class IOSPlatformLaunchAdapter implements PlatformLaunchAdapter {
  public readonly adapterId = 'ios-native-launch-adapter';
  public readonly targetPlatform: SupportedPlatform = 'ios';
  private bridge: NativeIOSBridge | null;

  constructor(bridge: NativeIOSBridge | null = null) {
    this.bridge = bridge;
  }

  public get isNativeBridgeAvailable(): boolean {
    return this.bridge !== null;
  }

  public getCapabilities(): PlatformCapabilitiesReport {
    return {
      detectedRuntime: this.bridge ? 'native-shell' : 'web-browser-preview',
      hostOSHint: 'ios',
      canEnumerateArbitrarySystemApps: false,
      supportedLaunchMethods: ['ios-universal-link', 'ios-url-scheme', 'external-web-url'],
      limitationsNote:
        'iOS and iPadOS do not permit enumerating installed apps or launching arbitrary apps by bundle ID. Only Universal Links or URL schemes declared in LSApplicationQueriesSchemes are supported.',
    };
  }

  public canHandleLaunchMethod(method: LaunchMethod): boolean {
    return (
      method === 'ios-universal-link' ||
      method === 'ios-url-scheme' ||
      method === 'external-web-url'
    );
  }

  public async launch(app: RegisteredApplication): Promise<LaunchResult> {
    if (!this.bridge) {
      return createLaunchResult(
        app,
        'native-integration-not-installed',
        false,
        false,
        `Cannot launch "${app.name}" via native iOS bridge because the native iOS runtime is not active.`,
        'NativeIOSBridge is not present.'
      );
    }

    try {
      const res = await this.bridge.openUniversalLinkOrScheme(app.verifiedLaunchTarget);
      if (!res.opened) {
        return createLaunchResult(
          app,
          'target-application-unavailable',
          false,
          false,
          `"${app.name}" could not be opened on iOS. Verify the app is installed and provides a supported Universal Link or registered URL scheme.`,
          res.errorReason
        );
      }
      return createLaunchResult(
        app,
        res.confirmed ? 'native-launch-confirmed' : 'launch-request-accepted',
        true,
        res.confirmed,
        `Opened "${app.name}".`
      );
    } catch (err) {
      return createLaunchResult(
        app,
        'launch-request-failed',
        false,
        false,
        `iOS failed to open "${app.name}".`,
        err instanceof Error ? err.message : 'iOS launch error'
      );
    }
  }
}

export interface NativeDesktopBridge {
  readonly platform: 'windows' | 'macos' | 'linux';
  launchProtocolOrBinary(
    method: 'desktop-protocol' | 'native-binary',
    target: string
  ): Promise<{
    launched: boolean;
    confirmed: boolean;
    errorReason?: string;
  }>;
}

export class DesktopPlatformLaunchAdapter implements PlatformLaunchAdapter {
  public readonly adapterId: string;
  public readonly targetPlatform: SupportedPlatform;
  private bridge: NativeDesktopBridge | null;

  constructor(
    platform: 'windows' | 'macos' | 'linux',
    bridge: NativeDesktopBridge | null = null
  ) {
    this.targetPlatform = platform;
    this.adapterId = `${platform}-desktop-launch-adapter`;
    this.bridge = bridge;
  }

  public get isNativeBridgeAvailable(): boolean {
    return this.bridge !== null;
  }

  public getCapabilities(): PlatformCapabilitiesReport {
    return {
      detectedRuntime: this.bridge ? 'native-shell' : 'web-browser-preview',
      hostOSHint: this.targetPlatform,
      canEnumerateArbitrarySystemApps: false,
      supportedLaunchMethods: ['desktop-protocol', 'native-binary', 'external-web-url'],
      limitationsNote: `Desktop launching on ${this.targetPlatform} uses registered application protocols or validated native desktop entries without arbitrary shell command execution.`,
    };
  }

  public canHandleLaunchMethod(method: LaunchMethod): boolean {
    return (
      method === 'desktop-protocol' ||
      method === 'native-binary' ||
      method === 'external-web-url'
    );
  }

  public async launch(app: RegisteredApplication): Promise<LaunchResult> {
    if (!this.bridge) {
      return createLaunchResult(
        app,
        'native-integration-not-installed',
        false,
        false,
        `Cannot launch "${app.name}" natively because the ${this.targetPlatform} desktop bridge is not installed in the web environment.`,
        `NativeDesktopBridge (${this.targetPlatform}) is not present.`
      );
    }

    if (
      app.launchMethod !== 'desktop-protocol' &&
      app.launchMethod !== 'native-binary'
    ) {
      return createLaunchResult(
        app,
        'unsupported-platform',
        false,
        false,
        `"${app.name}" launch method "${app.launchMethod}" is not handled by the ${this.targetPlatform} desktop adapter.`
      );
    }

    try {
      const res = await this.bridge.launchProtocolOrBinary(
        app.launchMethod,
        app.verifiedLaunchTarget
      );
      if (!res.launched) {
        return createLaunchResult(
          app,
          'target-application-unavailable',
          false,
          false,
          `"${app.name}" could not be launched on ${this.targetPlatform}. Verify the application is installed.`,
          res.errorReason
        );
      }
      return createLaunchResult(
        app,
        res.confirmed ? 'native-launch-confirmed' : 'launch-request-accepted',
        true,
        res.confirmed,
        `Launched "${app.name}" on ${this.targetPlatform}.`
      );
    } catch (err) {
      return createLaunchResult(
        app,
        'launch-request-failed',
        false,
        false,
        `Failed to launch "${app.name}" on ${this.targetPlatform}.`,
        err instanceof Error ? err.message : 'Desktop launch error'
      );
    }
  }
}

/**
 * ApplicationLaunchService
 *
 * Orchestrates safe external application launching:
 * 1. Validates application metadata and launch target syntax/security.
 * 2. Verifies installation, availability, and file presence.
 * 3. Verifies platform compatibility and required permissions.
 * 4. Selects the appropriate PlatformLaunchAdapter and returns a structured LaunchResult.
 */
export class ApplicationLaunchService {
  private compatibilityService: ApplicationCompatibilityService;
  private browserAdapter: PlatformLaunchAdapter;
  private nativeAdapters: Partial<Record<SupportedPlatform, PlatformLaunchAdapter>>;

  constructor(options?: {
    compatibilityService?: ApplicationCompatibilityService;
    browserAdapter?: PlatformLaunchAdapter;
    nativeAdapters?: Partial<Record<SupportedPlatform, PlatformLaunchAdapter>>;
  }) {
    this.compatibilityService =
      options?.compatibilityService ?? applicationCompatibilityService;
    this.browserAdapter =
      options?.browserAdapter ?? new BrowserPlatformLaunchAdapter();
    const discovered = discoverNativeLaunchBridges();
    this.nativeAdapters = options?.nativeAdapters ?? {
      android: new AndroidPlatformLaunchAdapter(discovered.androidBridge),
      ios: new IOSPlatformLaunchAdapter(discovered.iosBridge),
      windows: new DesktopPlatformLaunchAdapter(
        'windows',
        discovered.desktopBridges.windows ?? null
      ),
      macos: new DesktopPlatformLaunchAdapter(
        'macos',
        discovered.desktopBridges.macos ?? null
      ),
      linux: new DesktopPlatformLaunchAdapter(
        'linux',
        discovered.desktopBridges.linux ?? null
      ),
    };
  }

  public getCapabilities(): PlatformCapabilitiesReport {
    const env = this.compatibilityService.detectRuntimeEnvironment();
    const nativeAdapter = this.nativeAdapters[env.hostOSHint];
    if (nativeAdapter && nativeAdapter.isNativeBridgeAvailable) {
      return nativeAdapter.getCapabilities();
    }
    return this.browserAdapter.getCapabilities();
  }

  public async launchExternalApplication(
    app: RegisteredApplication,
    envOverride?: RuntimeEnvironmentDescriptor
  ): Promise<LaunchResult> {
    // 1. Validate untrusted metadata and launch target
    if (!app || typeof app !== 'object' || !app.id || !app.name) {
      return createLaunchResult(
        { id: 'unknown', name: 'Unknown Application' },
        'invalid-launch-target',
        false,
        false,
        'Application record is missing required identity metadata.',
        'Missing app.id or app.name'
      );
    }

    if (!app.signatureVerified) {
      return createLaunchResult(
        app,
        'invalid-launch-target',
        false,
        false,
        `Cannot launch "${app.name}" because its package signature is not verified.`,
        'signatureVerified is false'
      );
    }

    const targetValidation = validateLaunchTargetForMethod(
      app.launchMethod,
      app.verifiedLaunchTarget,
      app
    );
    if (!targetValidation.valid) {
      return createLaunchResult(
        app,
        'invalid-launch-target',
        false,
        false,
        `Cannot launch "${app.name}" because its launch target is invalid or unsafe.`,
        targetValidation.reason
      );
    }

    // 2. Check installation, availability, and file presence
    if (!app.installed || app.available === false || app.filesPresent === false) {
      return createLaunchResult(
        app,
        'target-application-unavailable',
        false,
        false,
        `"${app.name}" is currently unavailable or its application files are missing.`,
        app.filesPresent === false
          ? 'Application files missing.'
          : 'Application is not marked installed and available.'
      );
    }

    // 3. Check required permissions
    const permStatus = this.compatibilityService.checkPermissionsGranted(app);
    if (!permStatus.granted) {
      return createLaunchResult(
        app,
        'missing-permission',
        false,
        false,
        `"${app.name}" cannot be launched because required permissions were not granted (${permStatus.missingPermissions.join(', ')}).`,
        `Missing permissions: ${permStatus.missingPermissions.join(', ')}`
      );
    }

    // 4. Check platform compatibility
    const env = envOverride ?? this.compatibilityService.detectRuntimeEnvironment();
    const isPlatformCompatible =
      app.supportedPlatforms.includes('web') ||
      app.supportedPlatforms.includes(env.hostOSHint);

    if (!isPlatformCompatible) {
      return createLaunchResult(
        app,
        'unsupported-platform',
        false,
        false,
        `"${app.name}" is not supported on ${env.hostOSHint} (supports: ${app.supportedPlatforms.join(', ')}).`,
        `Host platform ${env.hostOSHint} not in [${app.supportedPlatforms.join(', ')}]`
      );
    }

    // 5. Select the appropriate PlatformLaunchAdapter
    const nativeAdapterForHost = this.nativeAdapters[env.hostOSHint];
    if (
      nativeAdapterForHost &&
      nativeAdapterForHost.isNativeBridgeAvailable &&
      nativeAdapterForHost.canHandleLaunchMethod(app.launchMethod)
    ) {
      return nativeAdapterForHost.launch(app);
    }

    // If the launch method strictly requires a native bridge (e.g. android-intent or native-binary)
    // and no native bridge is installed, delegate to the corresponding native adapter so it returns
    // an accurate `native-integration-not-installed` result.
    if (app.launchMethod === 'android-intent') {
      const androidAdapter =
        this.nativeAdapters.android ?? new AndroidPlatformLaunchAdapter(null);
      return androidAdapter.launch(app);
    }

    if (app.launchMethod === 'native-binary') {
      const desktopPlatform =
        env.hostOSHint === 'windows' ||
        env.hostOSHint === 'macos' ||
        env.hostOSHint === 'linux'
          ? env.hostOSHint
          : 'linux';
      const desktopAdapter =
        this.nativeAdapters[desktopPlatform] ??
        new DesktopPlatformLaunchAdapter(desktopPlatform, null);
      return desktopAdapter.launch(app);
    }

    // Use the BrowserPlatformLaunchAdapter for external URLs, Universal Links, and custom protocol handoffs
    if (this.browserAdapter.canHandleLaunchMethod(app.launchMethod)) {
      return this.browserAdapter.launch(app);
    }

    return createLaunchResult(
      app,
      'unsupported-platform',
      false,
      false,
      `"${app.name}" cannot be launched in the current environment.`,
      `No adapter available for launchMethod "${app.launchMethod}"`
    );
  }
}

export const platformAppLauncher = new ApplicationLaunchService();
