/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IcyPlatformConnectionStatus,
  IcyServiceStatusRecord,
} from '../types/launcher';

const SERVICE_STATUS_STORAGE_KEY = 'ic_app_launcher_platform_connection_status_v1';

const VALID_STATUSES: IcyPlatformConnectionStatus[] = [
  'not-configured',
  'not-connected',
  'connecting',
  'connected',
  'authentication-failed',
  'insufficient-permissions',
  'service-unavailable',
  'awaiting-authorization',
  'authenticated',
  'session-expired',
  'offline',
];

export const DEFAULT_SERVICE_STATUS: IcyServiceStatusRecord = {
  version: 1,
  status: 'not-configured',
  hasKeyConfigured: false,
  keyHint: null,
  hasBackendBaseUrlConfigured: false,
  lastVerifiedAt: null,
  errorDetail: null,
};

/**
 * Sanitizes and stores ONLY non-sensitive connection status and last verification timestamp.
 * Privileged ICY application API keys are NEVER stored in browser localStorage.
 */
export function sanitizeServiceStatusRecord(raw: unknown): IcyServiceStatusRecord {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SERVICE_STATUS };
  }
  const obj = raw as Record<string, unknown>;

  const status: IcyPlatformConnectionStatus =
    typeof obj.status === 'string' &&
    VALID_STATUSES.includes(obj.status as IcyPlatformConnectionStatus)
      ? (obj.status as IcyPlatformConnectionStatus)
      : 'not-configured';

  const hasKeyConfigured = obj.hasKeyConfigured === true;
  const keyHint =
    hasKeyConfigured && typeof obj.keyHint === 'string' && obj.keyHint.startsWith('••••')
      ? obj.keyHint.slice(0, 12)
      : null;

  const hasBackendBaseUrlConfigured = obj.hasBackendBaseUrlConfigured === true;
  const lastVerifiedAt =
    typeof obj.lastVerifiedAt === 'string' ? obj.lastVerifiedAt : null;

  // Never allow status to be 'connected' without a real verification timestamp
  const effectiveStatus: IcyPlatformConnectionStatus =
    status === 'connected' && !lastVerifiedAt ? 'not-connected' : status;

  return {
    version: 1,
    status: effectiveStatus,
    hasKeyConfigured,
    keyHint,
    hasBackendBaseUrlConfigured,
    lastVerifiedAt,
    errorDetail: typeof obj.errorDetail === 'string' ? obj.errorDetail : null,
  };
}

export function loadServiceStatusRecord(): IcyServiceStatusRecord {
  try {
    const raw = window.localStorage.getItem(SERVICE_STATUS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SERVICE_STATUS };
    return sanitizeServiceStatusRecord(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SERVICE_STATUS };
  }
}

export function saveServiceStatusRecord(
  record: IcyServiceStatusRecord
): IcyServiceStatusRecord {
  const sanitized = sanitizeServiceStatusRecord(record);
  try {
    window.localStorage.setItem(
      SERVICE_STATUS_STORAGE_KEY,
      JSON.stringify(sanitized)
    );
  } catch {
    // Ignore storage errors
  }
  return sanitized;
}
