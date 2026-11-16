/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ApplicationAvailabilityStatus,
  EvaluatedApplicationRecord,
  LaunchMethod,
  RegisteredApplication,
  SupportedPlatform,
} from '../types/launcher';
import { discoverNativeLaunchBridges } from './nativeShellBridge';

export interface RuntimeEnvironmentDescriptor {
  runtimeType: 'web-browser' | 'native-android' | 'native-ios' | 'native-windows' | 'native-macos' | 'native-linux';
  hostOSHint: SupportedPlatform;
  hasNativeLaunchBridge: boolean;
  supportedLaunchMethods: LaunchMethod[];
}

// Safe URI scheme pattern: RFC 3986 scheme (alpha followed by alphanumeric, +, -, .)
const SAFE_CUSTOM_SCHEME_REGEX = /^[a-z][a-z0-9+.-]{1,31}:\/\/[^\s<>"{}|\\^`]+$/i;

// Android package identifier pattern (e.g., com.icy.chat)
const ANDROID_PACKAGE_ID_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;

// Forbidden dangerous schemes and shell/injection tokens
const FORBIDDEN_SCHEMES = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'about:',
  'chrome:',
];

const SHELL_METACHARACTER_REGEX = /[;&|`$<>\\]/;

export interface LaunchTargetValidationResult {
  valid: boolean;
  normalizedTarget?: string;
  reason?: string;
}

/**
 * Validates that a launch target matches its declared LaunchMethod and is free from
 * unsafe URI schemes, shell metacharacters, or malformed syntax.
 * Treats all registry metadata and launch targets as untrusted input.
 */
export function validateLaunchTargetForMethod(
  launchMethod: LaunchMethod,
  rawTarget: string,
  app?: Partial<RegisteredApplication>
): LaunchTargetValidationResult {
  if (typeof rawTarget !== 'string') {
    return { valid: false, reason: 'Launch target must be a string.' };
  }

  const trimmed = rawTarget.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return { valid: false, reason: 'Launch target is empty or exceeds maximum length.' };
  }

  // Reject control characters or newlines
  if (/[\r\n\0\t]/.test(trimmed)) {
    return { valid: false, reason: 'Launch target contains control characters.' };
  }

  const lower = trimmed.toLowerCase();
  for (const forbidden of FORBIDDEN_SCHEMES) {
    if (lower.startsWith(forbidden)) {
      return {
        valid: false,
        reason: `Unsafe URI scheme "${forbidden}" is strictly prohibited.`,
      };
    }
  }

  switch (launchMethod) {
    case 'external-web-url':
    case 'ios-universal-link': {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return {
            valid: false,
            reason: `${launchMethod} requires an explicit https:// or http:// URL.`,
          };
        }
        if (launchMethod === 'ios-universal-link' && parsed.protocol !== 'https:') {
          return {
            valid: false,
            reason: 'iOS Universal Links require an https:// URL.',
          };
        }
        if (!parsed.hostname || parsed.hostname.trim().length === 0) {
          return { valid: false, reason: 'URL is missing a valid hostname.' };
        }
        return { valid: true, normalizedTarget: parsed.toString() };
      } catch {
        return { valid: false, reason: 'Malformed URL syntax.' };
      }
    }

    case 'ios-url-scheme':
    case 'desktop-protocol': {
      if (SHELL_METACHARACTER_REGEX.test(trimmed)) {
        return {
          valid: false,
          reason: 'Custom protocol URI contains prohibited shell or injection characters.',
        };
      }
      if (!SAFE_CUSTOM_SCHEME_REGEX.test(trimmed)) {
        return {
          valid: false,
          reason: 'Malformed custom protocol URI (expected scheme://path).',
        };
      }
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return {
            valid: false,
            reason: `${launchMethod} must use a registered custom protocol scheme rather than http/https.`,
          };
        }
        return { valid: true, normalizedTarget: trimmed };
      } catch {
        return { valid: false, reason: 'Unable to parse custom protocol URI.' };
      }
    }

    case 'android-intent': {
      if (SHELL_METACHARACTER_REGEX.test(trimmed)) {
        return {
          valid: false,
          reason: 'Android launch target contains prohibited metacharacters.',
        };
      }
      const packageId = app?.nativePackageId?.trim() || trimmed;
      const isIntentUri = lower.startsWith('intent://');
      const isValidPkg = ANDROID_PACKAGE_ID_REGEX.test(packageId);
      if (!isIntentUri && !isValidPkg) {
        return {
          valid: false,
          reason:
            'Android launch target must be a valid Android package identifier (e.g., com.icy.app) or verified intent:// URI.',
        };
      }
      return { valid: true, normalizedTarget: trimmed };
    }

    case 'native-binary': {
      // Never accept raw shell commands or relative path traversal
      if (SHELL_METACHARACTER_REGEX.test(trimmed) || trimmed.includes('..')) {
        return {
          valid: false,
          reason: 'Native binary target contains prohibited shell characters or path traversal.',
        };
      }
      // Require an identifier or validated absolute identifier token without spaces/arguments
      if (!/^[a-zA-Z0-9._/-]{2,256}$/.test(trimmed)) {
        return {
          valid: false,
          reason: 'Native binary target must be a registered application identifier without raw shell arguments.',
        };
      }
      return { valid: true, normalizedTarget: trimmed };
    }

    default:
      return { valid: false, reason: 'Unsupported launch method.' };
  }
}

/**
 * Evaluates whether a registered application record is installed, available, compatible
 * with the current runtime/device, and has the required permissions and native integration.
 */
export class ApplicationCompatibilityService {
  public detectRuntimeEnvironment(): RuntimeEnvironmentDescriptor {
    const discovered = discoverNativeLaunchBridges();
    if (discovered.activeNativePlatform === 'android' && discovered.androidBridge) {
      return {
        runtimeType: 'native-android',
        hostOSHint: 'android',
        hasNativeLaunchBridge: true,
        supportedLaunchMethods: ['android-intent', 'external-web-url'],
      };
    }
    if (discovered.activeNativePlatform === 'ios' && discovered.iosBridge) {
      return {
        runtimeType: 'native-ios',
        hostOSHint: 'ios',
        hasNativeLaunchBridge: true,
        supportedLaunchMethods: [
          'ios-universal-link',
          'ios-url-scheme',
          'external-web-url',
        ],
      };
    }
    if (
      discovered.activeNativePlatform === 'windows' ||
      discovered.activeNativePlatform === 'macos' ||
      discovered.activeNativePlatform === 'linux'
    ) {
      const p = discovered.activeNativePlatform;
      return {
        runtimeType: `native-${p}`,
        hostOSHint: p,
        hasNativeLaunchBridge: true,
        supportedLaunchMethods: [
          'desktop-protocol',
          'native-binary',
          'external-web-url',
        ],
      };
    }

    const hostOSHint = this.detectHostOSHint();
    // In a browser/web runtime without native Capacitor/Desktop bridges injected:
    return {
      runtimeType: 'web-browser',
      hostOSHint,
      hasNativeLaunchBridge: false,
      supportedLaunchMethods: [
        'external-web-url',
        'desktop-protocol',
        'ios-universal-link',
        'ios-url-scheme',
      ],
    };
  }

  public detectHostOSHint(): SupportedPlatform {
    if (typeof navigator === 'undefined') return 'web';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    return 'web';
  }

  public evaluateApplication(
    app: RegisteredApplication,
    env: RuntimeEnvironmentDescriptor = this.detectRuntimeEnvironment()
  ): EvaluatedApplicationRecord {
    // 1. Validate launch target syntax and security
    const targetValidation = validateLaunchTargetForMethod(
      app.launchMethod,
      app.verifiedLaunchTarget,
      app
    );
    if (!targetValidation.valid || !app.signatureVerified) {
      return {
        record: app,
        availabilityStatus: 'invalid-launch-configuration',
        isSelectableAndLaunchable: false,
        reason: targetValidation.reason || 'Application signature is not verified.',
      };
    }

    // 2. Check if application files are missing on disk/storage
    if (app.filesPresent === false) {
      return {
        record: app,
        availabilityStatus: 'missing-application-files',
        isSelectableAndLaunchable: false,
        reason: 'Application registry entry exists, but required application files are missing.',
      };
    }

    // 3. Check installation and availability flags
    if (!app.installed || app.available === false) {
      return {
        record: app,
        availabilityStatus: 'registered-unavailable',
        isSelectableAndLaunchable: false,
        reason: 'Application is registered in the catalog but not currently installed and active.',
      };
    }

    // 4. Check platform compatibility
    const isPlatformCompatible =
      app.supportedPlatforms.includes('web') ||
      app.supportedPlatforms.includes(env.hostOSHint);

    if (!isPlatformCompatible) {
      return {
        record: app,
        availabilityStatus: 'incompatible-platform',
        isSelectableAndLaunchable: false,
        reason: `Application requires ${app.supportedPlatforms.join(', ')} and is not compatible with ${env.hostOSHint}.`,
      };
    }

    // 5. Check whether the required native launch integration is available in the current runtime
    const requiresNativeBridge =
      app.launchMethod === 'native-binary' || app.launchMethod === 'android-intent';

    if (requiresNativeBridge && !env.hasNativeLaunchBridge) {
      return {
        record: app,
        availabilityStatus: 'native-integration-unavailable',
        isSelectableAndLaunchable: false,
        reason: `Launching via "${app.launchMethod}" requires the native IC App Launcher platform bridge, which is not installed in the web environment.`,
      };
    }

    return {
      record: app,
      availabilityStatus: 'installed-launchable',
      isSelectableAndLaunchable: true,
    };
  }

  public checkPermissionsGranted(app: RegisteredApplication): {
    granted: boolean;
    missingPermissions: string[];
  } {
    if (!Array.isArray(app.permissions) || app.permissions.length === 0) {
      return { granted: true, missingPermissions: [] };
    }
    if (!Array.isArray(app.grantedPermissions)) {
      // If permissions are required and grantedPermissions is explicitly provided as partial, check it.
      // When grantedPermissions is omitted on a verified installed record, assume install-time grant;
      // when provided as an array, verify every required permission is present.
      return { granted: true, missingPermissions: [] };
    }
    const missing = app.permissions.filter(
      (reqPerm) => !app.grantedPermissions!.includes(reqPerm)
    );
    return {
      granted: missing.length === 0,
      missingPermissions: missing,
    };
  }
}

export const applicationCompatibilityService = new ApplicationCompatibilityService();
