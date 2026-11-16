/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PasswordVerifierRecord } from '../types/launcher';
import '../platform/nativeShellBridge';

/**
 * Abstract interface for storing and retrieving the password verifier record.
 * This separation allows a native secure-storage adapter (e.g., Android Keystore,
 * iOS Keychain, Windows DPAPI, macOS Keychain, Linux Secret Service) to be swapped in
 * when packaging for native device targets.
 */
export interface SecureVerifierStorageAdapter {
  readonly adapterName: string;
  readonly isNativeHardwareBacked: boolean;
  loadVerifier(): Promise<PasswordVerifierRecord | null>;
  saveVerifier(record: PasswordVerifierRecord): Promise<void>;
  clearVerifier(): Promise<void>;
  loadLockState(): boolean;
  saveLockState(isLocked: boolean): void;
}

const VERIFIER_STORAGE_KEY = 'ic_app_launcher_security_verifier_v1';
const LOCK_STATE_STORAGE_KEY = 'ic_app_launcher_lock_state_v1';

function isValidVerifierRecord(data: unknown): data is PasswordVerifierRecord {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    candidate.algorithm === 'PBKDF2-SHA256' &&
    typeof candidate.iterations === 'number' &&
    candidate.iterations >= 10000 &&
    typeof candidate.saltHex === 'string' &&
    candidate.saltHex.length >= 32 &&
    typeof candidate.hashHex === 'string' &&
    candidate.hashHex.length >= 64
  );
}

/**
 * Web local storage adapter for the browser preview / PWA environment.
 * Stores only salted PBKDF2-SHA256 password verifiers (never plaintext passwords).
 */
export class WebSecureStorageAdapter implements SecureVerifierStorageAdapter {
  public readonly adapterName = 'Web Storage Verifier Adapter (PBKDF2-SHA256)';
  public readonly isNativeHardwareBacked = false;

  public loadVerifierSync(): PasswordVerifierRecord | null {
    try {
      const raw = window.localStorage.getItem(VERIFIER_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (isValidVerifierRecord(parsed)) {
        return parsed;
      }
      // Handle corrupted verifier gracefully by ignoring invalid structure
      return null;
    } catch {
      return null;
    }
  }

  public async loadVerifier(): Promise<PasswordVerifierRecord | null> {
    return this.loadVerifierSync();
  }

  public async saveVerifier(record: PasswordVerifierRecord): Promise<void> {
    try {
      window.localStorage.setItem(VERIFIER_STORAGE_KEY, JSON.stringify(record));
    } catch (err) {
      throw new Error(
        `Failed to persist password verifier: ${err instanceof Error ? err.message : 'Storage unavailable'}`
      );
    }
  }

  public async clearVerifier(): Promise<void> {
    try {
      window.localStorage.removeItem(VERIFIER_STORAGE_KEY);
      window.localStorage.removeItem(LOCK_STATE_STORAGE_KEY);
    } catch {
      // Ignore storage removal errors
    }
  }

  public loadLockState(): boolean {
    try {
      const verifier = this.loadVerifierSync();
      if (!verifier) return false;
      const raw = window.localStorage.getItem(LOCK_STATE_STORAGE_KEY);
      // When a password verifier is configured, startup routes to the lock screen by default
      if (raw === null) return true;
      return raw === 'locked';
    } catch {
      return false;
    }
  }

  public saveLockState(isLocked: boolean): void {
    try {
      window.localStorage.setItem(LOCK_STATE_STORAGE_KEY, isLocked ? 'locked' : 'unlocked');
    } catch {
      // Ignore
    }
  }
}

/**
 * Native hardware-backed secure storage adapter for Capacitor (Android Keystore / iOS Keychain)
 * and Electron desktop (`safeStorage` via DPAPI / macOS Keychain / Linux Secret Service).
 * Automatically delegates to the native bridge when running inside a packaged native shell while
 * maintaining a synchronized local verifier reference for synchronous startup route resolution.
 */
export class NativeSecureVerifierStorageAdapter implements SecureVerifierStorageAdapter {
  public readonly adapterName: string;
  public readonly isNativeHardwareBacked = true;
  private fallbackWebAdapter = new WebSecureStorageAdapter();

  constructor(platformLabel = 'Native OS Secure Keystore') {
    this.adapterName = `${platformLabel} Verifier Adapter (PBKDF2-SHA256)`;
  }

  private getNativeSecureCallbacks(): {
    getSecureItem?: (key: string) => Promise<string | null>;
    setSecureItem?: (key: string, value: string) => Promise<void>;
    removeSecureItem?: (key: string) => Promise<void>;
  } | null {
    if (typeof window === 'undefined') return null;
    if (window.__IC_APP_LAUNCHER_CAPACITOR_BRIDGE__?.getSecureItem) {
      return window.__IC_APP_LAUNCHER_CAPACITOR_BRIDGE__;
    }
    if (window.__IC_APP_LAUNCHER_DESKTOP_BRIDGE__?.getSecureItem) {
      return window.__IC_APP_LAUNCHER_DESKTOP_BRIDGE__;
    }
    return null;
  }

  public loadVerifierSync(): PasswordVerifierRecord | null {
    return this.fallbackWebAdapter.loadVerifierSync();
  }

  public async loadVerifier(): Promise<PasswordVerifierRecord | null> {
    const native = this.getNativeSecureCallbacks();
    if (native?.getSecureItem) {
      try {
        const raw = await native.getSecureItem(VERIFIER_STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isValidVerifierRecord(parsed)) {
            return parsed;
          }
        }
      } catch {
        // Fall back to synchronized local verifier
      }
    }
    return this.fallbackWebAdapter.loadVerifier();
  }

  public async saveVerifier(record: PasswordVerifierRecord): Promise<void> {
    await this.fallbackWebAdapter.saveVerifier(record);
    const native = this.getNativeSecureCallbacks();
    if (native?.setSecureItem) {
      await native.setSecureItem(VERIFIER_STORAGE_KEY, JSON.stringify(record));
    }
  }

  public async clearVerifier(): Promise<void> {
    await this.fallbackWebAdapter.clearVerifier();
    const native = this.getNativeSecureCallbacks();
    if (native?.removeSecureItem) {
      await native.removeSecureItem(VERIFIER_STORAGE_KEY);
    }
  }

  public loadLockState(): boolean {
    return this.fallbackWebAdapter.loadLockState();
  }

  public saveLockState(isLocked: boolean): void {
    this.fallbackWebAdapter.saveLockState(isLocked);
  }
}

export function createPlatformSecureStorageAdapter(): WebSecureStorageAdapter | NativeSecureVerifierStorageAdapter {
  if (typeof window !== 'undefined') {
    if (window.__IC_APP_LAUNCHER_CAPACITOR_BRIDGE__?.getSecureItem) {
      return new NativeSecureVerifierStorageAdapter(
        window.__IC_APP_LAUNCHER_CAPACITOR_BRIDGE__.platform === 'android'
          ? 'Android Keystore'
          : 'iOS Keychain'
      );
    }
    if (window.__IC_APP_LAUNCHER_DESKTOP_BRIDGE__?.getSecureItem) {
      return new NativeSecureVerifierStorageAdapter(
        `Desktop (${window.__IC_APP_LAUNCHER_DESKTOP_BRIDGE__.platform})`
      );
    }
  }
  return new WebSecureStorageAdapter();
}

export const defaultSecureStorageAdapter = createPlatformSecureStorageAdapter();
