/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScreenRoute } from '../types/launcher';

export interface InitialRouteContext {
  isSetupCompleted: boolean;
  hasConfiguredPassword: boolean;
}

/**
 * Determines the startup screen route based on first-run setup completion
 * and the saved launcher security state:
 * 1. If first-run setup has not been completed yet, open the 'setup' workflow.
 * 2. If setup is completed and no launcher password has been configured, open 'home' directly.
 * 3. If setup is completed and launcher password protection is enabled, show 'lock'.
 */
export function resolveStartupRoute(context: InitialRouteContext): ScreenRoute {
  if (!context.isSetupCompleted) {
    return 'setup';
  }
  if (context.hasConfiguredPassword) {
    return 'lock';
  }
  return 'home';
}

/**
 * Validates screen transitions so that protected screens cannot be entered while locked,
 * and lock/unlock screens are not visited when password protection is disabled.
 */
export function resolveSafeRouteTransition(
  targetRoute: ScreenRoute,
  hasConfiguredPassword: boolean,
  isLocked: boolean,
  isSetupCompleted: boolean = true
): ScreenRoute {
  if (!isSetupCompleted) {
    return 'setup';
  }

  // Once setup is completed, do not return to the first-run setup screen
  if (targetRoute === 'setup') {
    return hasConfiguredPassword && isLocked ? 'lock' : 'home';
  }

  // If password protection is disabled, never show lock or password-unlock screens
  if (!hasConfiguredPassword) {
    if (targetRoute === 'lock' || targetRoute === 'password-unlock') {
      return 'home';
    }
    return targetRoute;
  }

  // If password protection is enabled and the launcher is currently locked,
  // only 'lock' and 'password-unlock' are accessible until unlocked.
  if (isLocked) {
    if (targetRoute === 'password-unlock') {
      return 'password-unlock';
    }
    return 'lock';
  }

  return targetRoute;
}

