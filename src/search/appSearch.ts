/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RegisteredApplication } from '../types/launcher';
import {
  applicationCompatibilityService,
  RuntimeEnvironmentDescriptor,
} from '../platform/applicationCompatibility';

/**
 * Filters the installed application registry by supported searchable fields
 * (application name, publisher, description).
 * Only returns applications that are genuinely installed, verified, available,
 * and launchable on the current platform.
 * Never returns fabricated results or apps not in the actual installed registry.
 */
export function filterInstalledApplications(
  installedApps: readonly RegisteredApplication[],
  rawQuery: string,
  envOverride?: RuntimeEnvironmentDescriptor
): RegisteredApplication[] {
  const env =
    envOverride ?? applicationCompatibilityService.detectRuntimeEnvironment();

  const onlyLaunchableAndVerified = installedApps.filter((app) => {
    const evaluated = applicationCompatibilityService.evaluateApplication(
      app,
      env
    );
    return evaluated.isSelectableAndLaunchable;
  });

  const normalizedQuery = rawQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return onlyLaunchableAndVerified;
  }

  return onlyLaunchableAndVerified.filter((app) => {
    const nameMatch = app.name.toLowerCase().includes(normalizedQuery);
    const publisherMatch = app.publisher.toLowerCase().includes(normalizedQuery);
    const descriptionMatch = app.description
      ? app.description.toLowerCase().includes(normalizedQuery)
      : false;

    return nameMatch || publisherMatch || descriptionMatch;
  });
}

