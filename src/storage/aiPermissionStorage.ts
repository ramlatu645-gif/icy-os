/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AICapabilityPermissions } from '../types/launcher';

const AI_PERMISSIONS_STORAGE_KEY = 'ic_app_launcher_ai_capability_permissions_v1';

/**
 * Default AI Capability Permissions.
 * Follows the principle of least privilege:
 * - General chat/assistance is enabled by default.
 * - Sensitive capabilities (application context access and application actions) are
 *   disabled by default until explicitly granted by the user.
 * - Sensitive actions always require explicit user confirmation by default.
 */
export const DEFAULT_AI_PERMISSIONS: AICapabilityPermissions = {
  version: 1,
  chatAndAssistance: true,
  applicationContextAccess: false,
  applicationActions: false,
  requireConfirmationForSensitiveActions: true,
  authorizedContextAppIds: [],
  authorizedActionAppIds: [],
  updatedAt: new Date(0).toISOString(),
};

export function sanitizeAIPermissions(raw: unknown): AICapabilityPermissions {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_AI_PERMISSIONS,
      authorizedContextAppIds: [],
      authorizedActionAppIds: [],
      updatedAt: new Date().toISOString(),
    };
  }
  const obj = raw as Record<string, unknown>;

  const chatAndAssistance =
    typeof obj.chatAndAssistance === 'boolean'
      ? obj.chatAndAssistance
      : DEFAULT_AI_PERMISSIONS.chatAndAssistance;

  const applicationContextAccess =
    typeof obj.applicationContextAccess === 'boolean'
      ? obj.applicationContextAccess
      : DEFAULT_AI_PERMISSIONS.applicationContextAccess;

  const applicationActions =
    typeof obj.applicationActions === 'boolean'
      ? obj.applicationActions
      : DEFAULT_AI_PERMISSIONS.applicationActions;

  const requireConfirmationForSensitiveActions =
    typeof obj.requireConfirmationForSensitiveActions === 'boolean'
      ? obj.requireConfirmationForSensitiveActions
      : true;

  const authorizedContextAppIds = Array.isArray(obj.authorizedContextAppIds)
    ? Array.from(
        new Set(
          obj.authorizedContextAppIds.filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        )
      )
    : [];

  const authorizedActionAppIds = Array.isArray(obj.authorizedActionAppIds)
    ? Array.from(
        new Set(
          obj.authorizedActionAppIds.filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        )
      )
    : [];

  return {
    version: 1,
    chatAndAssistance,
    applicationContextAccess,
    applicationActions,
    requireConfirmationForSensitiveActions,
    authorizedContextAppIds,
    authorizedActionAppIds,
    updatedAt:
      typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
  };
}

export function loadAIPermissions(): AICapabilityPermissions {
  try {
    const raw = window.localStorage.getItem(AI_PERMISSIONS_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_AI_PERMISSIONS,
        authorizedContextAppIds: [],
        authorizedActionAppIds: [],
      };
    }
    return sanitizeAIPermissions(JSON.parse(raw));
  } catch {
    return {
      ...DEFAULT_AI_PERMISSIONS,
      authorizedContextAppIds: [],
      authorizedActionAppIds: [],
    };
  }
}

export function saveAIPermissions(
  permissions: AICapabilityPermissions
): AICapabilityPermissions {
  const sanitized = sanitizeAIPermissions({
    ...permissions,
    updatedAt: new Date().toISOString(),
  });
  try {
    window.localStorage.setItem(AI_PERMISSIONS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage errors
  }
  return sanitized;
}
