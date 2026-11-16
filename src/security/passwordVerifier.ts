/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PasswordVerifierRecord } from '../types/launcher';
import {
  SecureVerifierStorageAdapter,
  defaultSecureStorageAdapter,
} from './secureStorageAdapter';

const PBKDF2_ITERATIONS = 120000;
const SALT_BYTE_LENGTH = 16; // 128-bit salt
const KEY_BIT_LENGTH = 256; // 256-bit derived key

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const array = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    array[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return array;
}

/**
 * Constant-time string comparison to mitigate timing side-channels.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Derives a hex-encoded key using Web Crypto API PBKDF2-SHA256.
 */
async function derivePbkdf2HashHex(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<string> {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API is required for secure password hashing.');
  }

  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    KEY_BIT_LENGTH
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Creates a new salted PBKDF2-SHA256 password verifier record.
 * Never stores the password in plain text.
 */
export async function createPasswordVerifier(
  password: string
): Promise<PasswordVerifierRecord> {
  const trimmed = password;
  if (!trimmed || trimmed.length === 0) {
    throw new Error('Password cannot be empty.');
  }

  const salt = new Uint8Array(SALT_BYTE_LENGTH);
  window.crypto.getRandomValues(salt);

  const hashHex = await derivePbkdf2HashHex(trimmed, salt, PBKDF2_ITERATIONS);

  return {
    version: 1,
    algorithm: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    saltHex: bytesToHex(salt),
    hashHex,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validates a candidate password against a saved PasswordVerifierRecord.
 */
export async function verifyPasswordAgainstRecord(
  candidatePassword: string,
  record: PasswordVerifierRecord
): Promise<boolean> {
  if (!candidatePassword || !record) return false;
  try {
    const salt = hexToBytes(record.saltHex);
    const derivedHex = await derivePbkdf2HashHex(
      candidatePassword,
      salt,
      record.iterations
    );
    return timingSafeEqualHex(derivedHex, record.hashHex);
  } catch {
    return false;
  }
}

/**
 * Calculates a modest backoff delay (in milliseconds) after repeated failed attempts
 * without permanently locking the user out.
 * - Attempts 1-2: 0ms
 * - Attempt 3: 2000ms (2s)
 * - Attempt 4: 4000ms (4s)
 * - Attempt 5+: capped at 8000ms (8s)
 */
export function calculateBackoffDelayMs(failedAttempts: number): number {
  if (failedAttempts < 3) return 0;
  const delay = Math.min(8000, Math.pow(2, failedAttempts - 2) * 1000);
  return delay;
}

/**
 * High-level service managing launcher password verification and storage.
 */
export class LauncherSecurityService {
  private storage: SecureVerifierStorageAdapter;

  constructor(storage: SecureVerifierStorageAdapter = defaultSecureStorageAdapter) {
    this.storage = storage;
  }

  public hasConfiguredPasswordSync(): boolean {
    if ('loadVerifierSync' in this.storage && typeof this.storage.loadVerifierSync === 'function') {
      return (this.storage as { loadVerifierSync: () => PasswordVerifierRecord | null }).loadVerifierSync() !== null;
    }
    return false;
  }

  public async hasConfiguredPassword(): Promise<boolean> {
    const record = await this.storage.loadVerifier();
    return record !== null;
  }

  public async setNewPassword(newPassword: string): Promise<PasswordVerifierRecord> {
    const record = await createPasswordVerifier(newPassword);
    await this.storage.saveVerifier(record);
    this.storage.saveLockState(false);
    return record;
  }

  public async verifyPassword(candidatePassword: string): Promise<boolean> {
    const record = await this.storage.loadVerifier();
    if (!record) return false;
    return verifyPasswordAgainstRecord(candidatePassword, record);
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const isValid = await this.verifyPassword(currentPassword);
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect.' };
    }
    await this.setNewPassword(newPassword);
    return { success: true };
  }

  public async disablePasswordProtection(
    currentPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const isValid = await this.verifyPassword(currentPassword);
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect.' };
    }
    await this.storage.clearVerifier();
    return { success: true };
  }

  public setLocked(isLocked: boolean): void {
    this.storage.saveLockState(isLocked);
  }

  public getAdapterInfo(): { name: string; isNativeHardwareBacked: boolean } {
    return {
      name: this.storage.adapterName,
      isNativeHardwareBacked: this.storage.isNativeHardwareBacked,
    };
  }
}

export const launcherSecurityService = new LauncherSecurityService();
