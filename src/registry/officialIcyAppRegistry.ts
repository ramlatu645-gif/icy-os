/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RegisteredApplication } from '../types/launcher';

/**
 * Authoritative ICY Official Application Registry Definition.
 *
 * Remains empty by default: no pre-seeded or hardcoded ICY applications are
 * bundled inside the launcher. Official ICY applications are only included
 * once genuinely integrated and registered.
 *
 * Official ICY applications are kept strictly separate from third-party apps.
 */
export const OFFICIAL_ICY_APPLICATIONS: RegisteredApplication[] = [];

/**
 * Returns the authoritative official ICY application records.
 */
export function getAuthoritativeOfficialAppRegistry(): RegisteredApplication[] {
  return OFFICIAL_ICY_APPLICATIONS.map((app) => ({ ...app }));
}

/**
 * Look up an official app record by ID.
 */
export function getOfficialAppById(appId: string): RegisteredApplication | null {
  const found = OFFICIAL_ICY_APPLICATIONS.find((app) => app.id === appId);
  return found ? { ...found } : null;
}

/**
 * Validates that an app ID belongs to the authoritative official suite.
 */
export function isOfficialIcyApp(appId: string): boolean {
  return OFFICIAL_ICY_APPLICATIONS.some((app) => app.id === appId);
}

/**
 * Evaluates the scoped permissions permitted for an official app.
 * Guarantees that no official app receives unrestricted master credentials or scopes
 * outside its explicit manifest.
 */
export function getDelegatedPermissionsForApp(appId: string): string[] {
  const app = getOfficialAppById(appId);
  if (!app) return [];
  return [...app.permissions];
}
