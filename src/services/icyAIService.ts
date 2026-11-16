/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AIApplicationScope,
  AICapabilityPermissions,
  PersonalizedAIConfig,
  RegisteredApplication,
} from '../types/launcher';
import { HttpFetcher } from './icyPlatformBoundary';

export interface RegisteredAppAIAdapter {
  readonly appId: string;
  readonly supportsContextSharing: boolean;
  readonly supportedActionIds: string[];
  readonly sensitiveActionIds: string[];
  getSharedContext?: () => Promise<Record<string, unknown>>;
  executeAction?: (
    actionId: string,
    params?: Record<string, unknown>
  ) => Promise<{ executed: boolean; summary: string }>;
}

export interface PermissionDecision {
  allowed: boolean;
  requiresUserConfirmation: boolean;
  reason: string;
}

export interface AIAssistExecutionResult {
  allowed: boolean;
  deliveredToBackend: boolean;
  reply?: string;
  errorReason: string;
}

/**
 * Evaluates whether a registered application falls within the user's selected
 * AI application scope (`official-only`, `third-party-only`, or `both`).
 */
export function isAppWithinSelectedAIScope(
  app: RegisteredApplication,
  scope: AIApplicationScope
): boolean {
  if (!app.installed || !app.signatureVerified || app.available === false || app.filesPresent === false) {
    return false;
  }
  if (scope === 'official-only') {
    return app.source === 'icy-official';
  }
  if (scope === 'third-party-only') {
    return app.source === 'third-party';
  }
  if (scope === 'both') {
    return (
      app.source === 'icy-official' || app.source === 'third-party'
    );
  }
  return false;
}

/**
 * ICY AI Permission & Execution Service.
 *
 * Enforces in the execution layer (not just in UI controls):
 * 1. Assistant enablement (`config.enabled`)
 * 2. Application scope (`official-only`, `third-party-only`, `both`)
 * 3. Explicit registered application AI adapter existence (an app without a registered
 *    adapter cannot be controlled or read by the AI)
 * 4. Individual capability grants (`chatAndAssistance`, `applicationContextAccess`, `applicationActions`)
 * 5. Mandatory user confirmation for sensitive actions
 * 6. Strict lock-screen pre-unlock restrictions (never reveals private account info,
 *    private app context, credentials, or executes application actions while locked)
 */
export class IcyAIPermissionAndExecutionService {
  private registeredAppAdapters = new Map<string, RegisteredAppAIAdapter>();
  private fetcher: HttpFetcher;

  constructor(fetcher?: HttpFetcher) {
    this.fetcher =
      fetcher ??
      (async (input, init) => {
        const res = await fetch(input, init);
        return {
          ok: res.ok,
          status: res.status,
          json: () => res.json(),
        };
      });
  }

  public registerAppAIAdapter(adapter: RegisteredAppAIAdapter): void {
    if (!adapter || !adapter.appId) return;
    this.registeredAppAdapters.set(adapter.appId, adapter);
  }

  public unregisterAppAIAdapter(appId: string): void {
    this.registeredAppAdapters.delete(appId);
  }

  public hasRegisteredAdapter(appId: string): boolean {
    return this.registeredAppAdapters.has(appId);
  }

  /**
   * Checks whether general chat/assistance can be invoked in the current lock state.
   */
  public canUseChatAssistance(
    config: PersonalizedAIConfig,
    permissions: AICapabilityPermissions,
    isLauncherLocked: boolean
  ): PermissionDecision {
    if (isLauncherLocked) {
      if (!config.lockScreenChatEnabled) {
        return {
          allowed: false,
          requiresUserConfirmation: false,
          reason: 'Lock-screen AI chat is disabled. Unlock IC App Launcher to use your assistant.',
        };
      }
      if (!permissions.chatAndAssistance) {
        return {
          allowed: false,
          requiresUserConfirmation: false,
          reason: 'Chat and assistance permission is not granted.',
        };
      }
      return {
        allowed: true,
        requiresUserConfirmation: false,
        reason:
          'Permitted in restricted pre-unlock mode (no private account data, app context, or actions).',
      };
    }

    if (!config.enabled) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: `${config.assistantName} is currently disabled in Settings.`,
      };
    }

    if (!permissions.chatAndAssistance) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: 'Chat and assistance capability permission has not been granted.',
      };
    }

    return {
      allowed: true,
      requiresUserConfirmation: false,
      reason: 'Chat and assistance authorized.',
    };
  }

  /**
   * Checks whether the AI is authorized to access context from a specific application.
   */
  public canAccessApplicationContext(
    app: RegisteredApplication,
    config: PersonalizedAIConfig,
    permissions: AICapabilityPermissions,
    isLauncherLocked: boolean
  ): PermissionDecision {
    if (isLauncherLocked) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: 'Private application context access is strictly prohibited while the launcher is locked.',
      };
    }

    if (!config.enabled) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: 'ICY AI assistant is disabled.',
      };
    }

    if (!permissions.applicationContextAccess) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: 'Application context access permission is denied.',
      };
    }

    if (!isAppWithinSelectedAIScope(app, config.applicationScope)) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: `Application "${app.name}" (${app.source}) is outside the selected AI scope (${config.applicationScope}).`,
      };
    }

    const adapter = this.registeredAppAdapters.get(app.id);
    if (!adapter || !adapter.supportsContextSharing || typeof adapter.getSharedContext !== 'function') {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: `Application "${app.name}" does not have a registered ICY AI context adapter.`,
      };
    }

    // If per-app context allowlist is populated, check that the app is authorized
    if (
      permissions.authorizedContextAppIds.length > 0 &&
      !permissions.authorizedContextAppIds.includes(app.id)
    ) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: `Context sharing for "${app.name}" has not been authorized.`,
      };
    }

    return {
      allowed: true,
      requiresUserConfirmation: false,
      reason: `Authorized to read shared context from "${app.name}".`,
    };
  }

  /**
   * Checks whether the AI is authorized to execute a specific action in a target application.
   */
  public canExecuteApplicationAction(
    app: RegisteredApplication,
    actionId: string,
    config: PersonalizedAIConfig,
    permissions: AICapabilityPermissions,
    isLauncherLocked: boolean,
    userConfirmedSensitiveAction: boolean = false
  ): PermissionDecision {
    if (isLauncherLocked) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: 'Application actions cannot be executed while the launcher is locked.',
      };
    }

    if (!config.enabled) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: 'ICY AI assistant is disabled.',
      };
    }

    if (!permissions.applicationActions) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: 'Application actions permission is denied.',
      };
    }

    if (!isAppWithinSelectedAIScope(app, config.applicationScope)) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: `Application "${app.name}" (${app.source}) is outside the selected AI scope (${config.applicationScope}).`,
      };
    }

    const adapter = this.registeredAppAdapters.get(app.id);
    if (!adapter || typeof adapter.executeAction !== 'function') {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: `Application "${app.name}" has no registered ICY AI action adapter.`,
      };
    }

    if (!adapter.supportedActionIds.includes(actionId)) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: `Action "${actionId}" is not supported by "${app.name}".`,
      };
    }

    // If per-app action allowlist is populated, check that the app is authorized
    if (
      permissions.authorizedActionAppIds.length > 0 &&
      !permissions.authorizedActionAppIds.includes(app.id)
    ) {
      return {
        allowed: false,
        requiresUserConfirmation: false,
        reason: `Action execution for "${app.name}" has not been authorized.`,
      };
    }

    const isSensitive =
      adapter.sensitiveActionIds.includes(actionId) ||
      permissions.requireConfirmationForSensitiveActions;

    if (isSensitive && !userConfirmedSensitiveAction) {
      return {
        allowed: false,
        requiresUserConfirmation: true,
        reason: `Action "${actionId}" on "${app.name}" requires explicit user confirmation before execution.`,
      };
    }

    return {
      allowed: true,
      requiresUserConfirmation: false,
      reason: `Action "${actionId}" on "${app.name}" is authorized.`,
    };
  }

  /**
   * Executes an application action only after enforcing all scope, adapter, permission,
   * lock-state, and user-confirmation checks.
   */
  public async executeAuthorizedAppAction(
    app: RegisteredApplication,
    actionId: string,
    params: Record<string, unknown> | undefined,
    config: PersonalizedAIConfig,
    permissions: AICapabilityPermissions,
    isLauncherLocked: boolean,
    userConfirmedSensitiveAction: boolean = false
  ): Promise<{
    executed: boolean;
    requiresConfirmation: boolean;
    message: string;
  }> {
    const decision = this.canExecuteApplicationAction(
      app,
      actionId,
      config,
      permissions,
      isLauncherLocked,
      userConfirmedSensitiveAction
    );

    if (!decision.allowed) {
      return {
        executed: false,
        requiresConfirmation: decision.requiresUserConfirmation,
        message: decision.reason,
      };
    }

    const adapter = this.registeredAppAdapters.get(app.id)!;
    const outcome = await adapter.executeAction!(actionId, params);
    return {
      executed: outcome.executed,
      requiresConfirmation: false,
      message: outcome.summary,
    };
  }

  /**
   * Sends a chat/assistance request to the ICY AI Engine backend (`/api/icy-ai/assist`),
   * enforcing all permission and lock-screen privacy boundaries before making any request.
   * Never fabricates a response when the service is offline or unconfigured.
   */
  public async sendAssistanceRequest(params: {
    prompt: string;
    config: PersonalizedAIConfig;
    permissions: AICapabilityPermissions;
    isLauncherLocked: boolean;
  }): Promise<AIAssistExecutionResult> {
    const { prompt, config, permissions, isLauncherLocked } = params;

    const decision = this.canUseChatAssistance(
      config,
      permissions,
      isLauncherLocked
    );
    if (!decision.allowed) {
      return {
        allowed: false,
        deliveredToBackend: false,
        errorReason: decision.reason,
      };
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return {
        allowed: false,
        deliveredToBackend: false,
        errorReason: 'Please enter a message.',
      };
    }

    try {
      const res = await this.fetcher('/api/icy-ai/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          assistantName: config.assistantName,
          // Strictly pass lock state so backend never accesses private context when locked
          isLockedContext: isLauncherLocked,
        }),
      });

      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok || data.ok !== true || typeof data.reply !== 'string') {
        return {
          allowed: true,
          deliveredToBackend: false,
          errorReason:
            typeof data.errorDetail === 'string'
              ? data.errorDetail
              : 'ICY AI Engine is currently unavailable.',
        };
      }

      return {
        allowed: true,
        deliveredToBackend: true,
        reply: data.reply,
        errorReason: '',
      };
    } catch (err) {
      return {
        allowed: true,
        deliveredToBackend: false,
        errorReason: `ICY AI Engine is unreachable: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      };
    }
  }
}

export const icyAIService = new IcyAIPermissionAndExecutionService();
