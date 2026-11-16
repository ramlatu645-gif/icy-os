/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DelegatedAppToken,
  IcyAccountSessionRecord,
  RegisteredApplication,
} from '../types/launcher';
import {
  getDelegatedPermissionsForApp,
  getOfficialAppById,
  isOfficialIcyApp,
} from '../registry/officialIcyAppRegistry';

export interface ServiceBusRequestContext {
  appId: string;
  requestedPermission: string;
  operationDescription: string;
}

export interface ServiceBusDispatchResult {
  authorized: boolean;
  status:
    | 'authorized'
    | 'unauthorized-scope'
    | 'session-unauthenticated'
    | 'unknown-application'
    | 'third-party-restricted';
  delegatedToken?: DelegatedAppToken;
  message: string;
}

/**
 * ICY Service Bus Client & Authorization Boundary.
 *
 * Enforces per-service least privilege:
 * - Compatible first-party apps only receive their specific scoped delegated tokens.
 * - Master credentials or root tokens are NEVER distributed to applications.
 * - An app registering with the bus does NOT gain access to chat, mail, files,
 *   or private resources unless explicitly authorized for that specific scope.
 * - Keeps official ICY apps strictly separated from third-party apps.
 */
export class IcyServiceBus {
  /**
   * Evaluates if a given application is authorized to perform an operation.
   * Scrutinizes requested permissions against the authoritative registry manifest
   * and the current user's active session.
   */
  public authorizeOperation(
    app: RegisteredApplication,
    requestedPermission: string,
    currentSession: IcyAccountSessionRecord
  ): ServiceBusDispatchResult {
    // 1. Check if user is authenticated
    if (!currentSession.isAuthenticated || currentSession.status !== 'connected' && currentSession.status !== 'authenticated') {
      return {
        authorized: false,
        status: 'session-unauthenticated',
        message: 'Cannot authorize operation: User is not authenticated with ICY Account.',
      };
    }

    // 2. Reject third-party apps requesting official ICY core scopes
    if (app.source !== 'icy-official') {
      if (
        requestedPermission.startsWith('account:') ||
        requestedPermission.startsWith('security:keys:') ||
        requestedPermission.startsWith('system:')
      ) {
        return {
          authorized: false,
          status: 'third-party-restricted',
          message: `Third-party application "${app.name}" is forbidden from requesting core system permission "${requestedPermission}".`,
        };
      }
    }

    // 3. Verify that the requested permission is declared in the app's registered permissions
    const declaredPermissions = isOfficialIcyApp(app.id)
      ? getDelegatedPermissionsForApp(app.id)
      : app.permissions;

    if (!declaredPermissions.includes(requestedPermission)) {
      return {
        authorized: false,
        status: 'unauthorized-scope',
        message: `Application "${app.name}" (${app.id}) does not declare required permission "${requestedPermission}" in its manifest.`,
      };
    }

    // 4. Verify that the user's granted scopes encompass the permission domain
    const permissionDomain = requestedPermission.split(':')[0];
    const isDomainAllowed =
      currentSession.grantedScopes.includes('*') ||
      currentSession.grantedScopes.includes(permissionDomain) ||
      currentSession.grantedScopes.includes(requestedPermission);

    if (!isDomainAllowed) {
      return {
        authorized: false,
        status: 'unauthorized-scope',
        message: `Account session has not granted scope for permission "${requestedPermission}".`,
      };
    }

    return {
      authorized: true,
      status: 'authorized',
      message: `Operation authorized for "${app.name}" with scoped permission "${requestedPermission}".`,
    };
  }

  /**
   * Generates or acquires a least-privilege delegated token for a specific application.
   * Never leaks master credentials or tokens for other services.
   */
  public generateDelegatedToken(
    appId: string,
    currentSession: IcyAccountSessionRecord
  ): DelegatedAppToken | null {
    if (!currentSession.isAuthenticated) {
      return null;
    }

    const officialApp = getOfficialAppById(appId);
    if (!officialApp) {
      return null;
    }

    // Filter app permissions to only those permitted by current session
    const permittedScopes = officialApp.permissions.filter((perm) => {
      const domain = perm.split(':')[0];
      return (
        currentSession.grantedScopes.includes('*') ||
        currentSession.grantedScopes.includes(domain) ||
        currentSession.grantedScopes.includes(perm)
      );
    });

    const now = Date.now();
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString(); // 15-minute scoped token
    const tokenPayload = `icy_del_${appId}_${now.toString(36)}`;

    return {
      appId,
      tokenType: 'Bearer',
      delegatedToken: tokenPayload,
      permissions: permittedScopes,
      expiresAt,
    };
  }
}

export const icyServiceBus = new IcyServiceBus();
