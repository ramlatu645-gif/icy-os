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
import {
  applicationCompatibilityService,
  ApplicationCompatibilityService,
  RuntimeEnvironmentDescriptor,
  validateLaunchTargetForMethod,
} from '../platform/applicationCompatibility';

const REGISTRY_STORAGE_KEY = 'ic_app_launcher_installed_app_registry_v1';
const UNINSTALLED_STORAGE_KEY = 'ic_app_launcher_uninstalled_ids_v1';

export function getUninstalledAppIds(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(UNINSTALLED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function recordUninstalledAppId(appId: string): void {
  try {
    if (typeof window === 'undefined') return;
    const list = getUninstalledAppIds();
    if (!list.includes(appId)) {
      list.push(appId);
      window.localStorage.setItem(UNINSTALLED_STORAGE_KEY, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
}



const SUPPORTED_PLATFORMS: SupportedPlatform[] = [
  'android',
  'ios',
  'windows',
  'macos',
  'linux',
  'web',
];

const SUPPORTED_LAUNCH_METHODS: LaunchMethod[] = [
  'android-intent',
  'ios-universal-link',
  'ios-url-scheme',
  'desktop-protocol',
  'native-binary',
  'external-web-url',
];

export interface RegistrationValidationResult {
  accepted: boolean;
  reason?: string;
  record?: RegisteredApplication;
}

/**
 * Validates that an application record contains complete, untrusted-input-safe metadata
 * and a valid launch configuration.
 * Never trusts an application solely because a database record exists or because of a filename extension.
 */
export function validateApplicationRecord(
  entry: unknown
): RegistrationValidationResult {
  if (!entry || typeof entry !== 'object') {
    return { accepted: false, reason: 'Application record must be an object.' };
  }

  const app = entry as Record<string, unknown>;

  if (typeof app.id !== 'string' || !/^[a-zA-Z0-9._-]{2,128}$/.test(app.id.trim())) {
    return {
      accepted: false,
      reason: 'Application ID is missing or contains invalid characters.',
    };
  }

  if (typeof app.name !== 'string' || app.name.trim().length === 0 || app.name.trim().length > 80) {
    return {
      accepted: false,
      reason: 'Application name is required and must be 1–80 characters.',
    };
  }

  // Reject applications that masquerade as trustworthy solely via executable extensions in their name
  if (/\.(apk|exe|msi|dmg|pkg|deb|rpm|appimage|sh|bat|cmd)$/i.test(app.name.trim())) {
    return {
      accepted: false,
      reason: 'Application name cannot be a raw installer or executable filename.',
    };
  }

  if (typeof app.version !== 'string' || !/^[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.-]+)?$/.test(app.version.trim())) {
    return {
      accepted: false,
      reason: 'Application version must follow semantic versioning (e.g., 1.0.0).',
    };
  }

  if (typeof app.publisher !== 'string' || app.publisher.trim().length === 0) {
    return {
      accepted: false,
      reason: 'Application publisher is required.',
    };
  }

  if (app.source !== 'icy-official' && app.source !== 'third-party') {
    return {
      accepted: false,
      reason: 'Application source must be "icy-official" or "third-party".',
    };
  }

  if (typeof app.iconResource !== 'string' || app.iconResource.trim().length === 0) {
    return {
      accepted: false,
      reason: 'Application icon resource identifier is required.',
    };
  }

  if (typeof app.installed !== 'boolean') {
    return {
      accepted: false,
      reason: 'Application installed status must be an explicit boolean.',
    };
  }

  if (app.signatureVerified !== true) {
    return {
      accepted: false,
      reason: 'Application package signature verification is required.',
    };
  }

  if (
    typeof app.launchMethod !== 'string' ||
    !SUPPORTED_LAUNCH_METHODS.includes(app.launchMethod as LaunchMethod)
  ) {
    return {
      accepted: false,
      reason: 'Unsupported or missing application launch method.',
    };
  }

  if (typeof app.verifiedLaunchTarget !== 'string' || app.verifiedLaunchTarget.trim().length === 0) {
    return {
      accepted: false,
      reason: 'Verified launch target is required.',
    };
  }

  const targetValidation = validateLaunchTargetForMethod(
    app.launchMethod as LaunchMethod,
    app.verifiedLaunchTarget,
    app as Partial<RegisteredApplication>
  );

  if (!targetValidation.valid) {
    return {
      accepted: false,
      reason: targetValidation.reason || 'Malformed or unsafe launch target.',
    };
  }

  if (!Array.isArray(app.supportedPlatforms) || app.supportedPlatforms.length === 0) {
    return {
      accepted: false,
      reason: 'At least one supported device platform must be specified.',
    };
  }

  const allPlatformsValid = app.supportedPlatforms.every(
    (p) => typeof p === 'string' && SUPPORTED_PLATFORMS.includes(p as SupportedPlatform)
  );
  if (!allPlatformsValid) {
    return {
      accepted: false,
      reason: 'Application specifies an unrecognized device platform.',
    };
  }

  const permissions = Array.isArray(app.permissions)
    ? app.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  const capabilities = Array.isArray(app.capabilities)
    ? app.capabilities.filter((c): c is string => typeof c === 'string')
    : [];

  const normalizedRecord: RegisteredApplication = {
    id: app.id.trim(),
    name: app.name.trim(),
    description: typeof app.description === 'string' ? app.description.trim() : undefined,
    iconResource: app.iconResource.trim(),
    version: app.version.trim(),
    publisher: app.publisher.trim(),
    source: app.source,
    installed: app.installed,
    available: typeof app.available === 'boolean' ? app.available : true,
    filesPresent: typeof app.filesPresent === 'boolean' ? app.filesPresent : true,
    supportedPlatforms: app.supportedPlatforms as SupportedPlatform[],
    launchMethod: app.launchMethod as LaunchMethod,
    verifiedLaunchTarget: targetValidation.normalizedTarget || app.verifiedLaunchTarget.trim(),
    nativePackageId:
      typeof app.nativePackageId === 'string' ? app.nativePackageId.trim() : undefined,
    registeredProtocol:
      typeof app.registeredProtocol === 'string' ? app.registeredProtocol.trim() : undefined,
    officialAppLink:
      typeof app.officialAppLink === 'string' ? app.officialAppLink.trim() : undefined,
    signatureVerified: true,
    permissions,
    grantedPermissions: Array.isArray(app.grantedPermissions)
      ? app.grantedPermissions.filter((p): p is string => typeof p === 'string')
      : undefined,
    capabilities,
    installedAt:
      typeof app.installedAt === 'string' ? app.installedAt : new Date().toISOString(),
  };

  return {
    accepted: true,
    record: normalizedRecord,
  };
}

/**
 * Type guard verifying if an entry is a valid AND installed application record.
 */
export function isValidInstalledApp(entry: unknown): entry is RegisteredApplication {
  const result = validateApplicationRecord(entry);
  return (
    result.accepted &&
    result.record !== undefined &&
    result.record.installed === true &&
    result.record.available !== false &&
    result.record.filesPresent !== false
  );
}

/**
 * ApplicationRegistryService
 *
 * Stores, validates, and categorizes registered application records.
 * Distinguishes between:
 * - Installed and launchable applications (`installed-launchable`)
 * - Registered but unavailable applications (`registered-unavailable`)
 * - Applications with missing files (`missing-application-files`)
 * - Applications incompatible with the current device (`incompatible-platform`)
 * - Applications whose required native launch integration is unavailable (`native-integration-unavailable`)
 *
 * Stage 1 & Stage 2 Rule:
 * The initial application registry remains empty unless genuine applications are registered.
 * Never invents fake ICY apps or sample third-party apps.
 */
export class ApplicationRegistryService {
  private compatibilityService: ApplicationCompatibilityService;

  constructor(
    compatibilityService: ApplicationCompatibilityService = applicationCompatibilityService
  ) {
    this.compatibilityService = compatibilityService;
  }

  /**
   * Loads all validated registry records from persistent storage, rejecting
   * malformed records and deduplicating by application ID.
   */
  public getAllRegisteredRecords(): RegisteredApplication[] {
    try {
      const uninstalledSet = new Set(getUninstalledAppIds());
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(REGISTRY_STORAGE_KEY) : null;
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const seenIds = new Set<string>();
      const validRecords: RegisteredApplication[] = [];
      let purgedLegacySeed = false;

      for (const item of parsed) {
        const validation = validateApplicationRecord(item);
        if (validation.accepted && validation.record) {
          const isLegacySeededIcyApp =
            validation.record.source === 'icy-official' &&
            validation.record.installedAt === '2026-01-01T00:00:00.000Z';

          if (isLegacySeededIcyApp) {
            purgedLegacySeed = true;
            continue;
          }

          if (!uninstalledSet.has(validation.record.id) && !seenIds.has(validation.record.id)) {
            seenIds.add(validation.record.id);
            validRecords.push(validation.record);
          }
        }
      }

      if (purgedLegacySeed && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(validRecords));
        } catch {
          // ignore
        }
      }

      return validRecords;
    } catch {
      return [];
    }
  }

  /**
   * Evaluates all registered records against the current platform and runtime environment.
   */
  public getEvaluatedRegistry(
    envOverride?: RuntimeEnvironmentDescriptor
  ): EvaluatedApplicationRecord[] {
    const records = this.getAllRegisteredRecords();
    const env = envOverride ?? this.compatibilityService.detectRuntimeEnvironment();
    return records.map((record) =>
      this.compatibilityService.evaluateApplication(record, env)
    );
  }

  /**
   * Returns ONLY installed and launchable applications for the main launcher icon grid.
   * Unavailable, missing-file, incompatible, or unlaunchable apps are excluded from
   * normal selectable icons.
   */
  public getInstalledApplications(
    envOverride?: RuntimeEnvironmentDescriptor
  ): RegisteredApplication[] {
    return this.getEvaluatedRegistry(envOverride)
      .filter((item) => item.isSelectableAndLaunchable)
      .map((item) => item.record);
  }

  /**
   * Returns records filtered by their evaluated availability status.
   */
  public getApplicationsByStatus(
    status: ApplicationAvailabilityStatus,
    envOverride?: RuntimeEnvironmentDescriptor
  ): EvaluatedApplicationRecord[] {
    return this.getEvaluatedRegistry(envOverride).filter(
      (item) => item.availabilityStatus === status
    );
  }

  /**
   * Look up a single registered application by ID.
   */
  public getApplicationById(appId: string): RegisteredApplication | null {
    const all = this.getAllRegisteredRecords();
    return all.find((app) => app.id === appId) ?? null;
  }

  /**
   * Registers a new application record into the registry.
   * Rejects duplicate application IDs, malformed launch targets, missing metadata,
   * and unverified signatures.
   */
  public registerApplication(candidate: unknown): RegistrationValidationResult {
    const validation = validateApplicationRecord(candidate);
    if (!validation.accepted || !validation.record) {
      return validation;
    }

    const current = this.getAllRegisteredRecords();
    const duplicateExists = current.some((item) => item.id === validation.record!.id);
    if (duplicateExists) {
      return {
        accepted: false,
        reason: `Duplicate application ID "${validation.record.id}" is already registered.`,
      };
    }

    current.push(validation.record);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(current));
        if (typeof window.dispatchEvent === 'function') {
          try {
            window.dispatchEvent(new Event('icy-registry-changed'));
          } catch {
            // ignore
          }
        }
      }
      return validation;
    } catch {
      return {
        accepted: false,
        reason: 'Failed to persist application record to local storage.',
      };
    }
  }

  /**
   * Updates an existing application's installation or file-presence state
   * (e.g., marking an application unavailable if its underlying files are missing).
   */
  public markApplicationFileStatus(
    appId: string,
    filesPresent: boolean,
    available: boolean = filesPresent
  ): boolean {
    const current = this.getAllRegisteredRecords();
    const index = current.findIndex((item) => item.id === appId);
    if (index === -1) return false;

    current[index] = {
      ...current[index],
      filesPresent,
      available,
    };

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(current));
        if (typeof window.dispatchEvent === 'function') {
          try {
            window.dispatchEvent(new Event('icy-registry-changed'));
          } catch {
            // ignore
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Backward-compatible wrapper that validates and registers an application,
   * rejecting duplicates.
   */
  public registerVerifiedApplication(app: RegisteredApplication): boolean {
    const res = this.registerApplication(app);
    return res.accepted;
  }

  public unregisterApplication(appId: string): void {
    recordUninstalledAppId(appId);
    const current = this.getAllRegisteredRecords();
    const updated = current.filter((item) => item.id !== appId);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(updated));
        if (typeof window.dispatchEvent === 'function') {
          try {
            window.dispatchEvent(new Event('icy-registry-changed'));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  public clearRegistry(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(REGISTRY_STORAGE_KEY);
        if (typeof window.dispatchEvent === 'function') {
          try {
            window.dispatchEvent(new Event('icy-registry-changed'));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Ignore
    }
  }
}

export const applicationRegistry = new ApplicationRegistryService();
