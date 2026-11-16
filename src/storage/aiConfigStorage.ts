/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIApplicationScope, PersonalizedAIConfig } from '../types/launcher';

const AI_CONFIG_STORAGE_KEY = 'ic_app_launcher_personalized_ai_config_v1';

const VALID_SCOPES: AIApplicationScope[] = [
  'official-only',
  'third-party-only',
  'both',
];

export const DEFAULT_AI_CONFIG: PersonalizedAIConfig = {
  version: 1,
  assistantName: 'ICY AI',
  enabled: true,
  applicationScope: 'official-only',
  lockScreenChatEnabled: false,
  updatedAt: new Date(0).toISOString(),
};

export function validateAssistantName(rawName: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      normalized: '',
      error: 'Please enter a name for your ICY AI assistant.',
    };
  }
  if (trimmed.length > 40) {
    return {
      valid: false,
      normalized: trimmed.slice(0, 40),
      error: 'Assistant name must be 40 characters or fewer.',
    };
  }
  return {
    valid: true,
    normalized: trimmed,
  };
}

export function sanitizeAIConfig(raw: unknown): PersonalizedAIConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AI_CONFIG, updatedAt: new Date().toISOString() };
  }
  const obj = raw as Record<string, unknown>;

  let assistantName = DEFAULT_AI_CONFIG.assistantName;
  if (typeof obj.assistantName === 'string') {
    const validated = validateAssistantName(obj.assistantName);
    if (validated.valid) {
      assistantName = validated.normalized;
    }
  }

  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_AI_CONFIG.enabled;

  const applicationScope: AIApplicationScope =
    typeof obj.applicationScope === 'string' &&
    VALID_SCOPES.includes(obj.applicationScope as AIApplicationScope)
      ? (obj.applicationScope as AIApplicationScope)
      : DEFAULT_AI_CONFIG.applicationScope;

  // Lock-screen AI chat is a separate optional setting independent from general assistant enablement
  const lockScreenChatEnabled =
    typeof obj.lockScreenChatEnabled === 'boolean'
      ? obj.lockScreenChatEnabled
      : DEFAULT_AI_CONFIG.lockScreenChatEnabled;

  return {
    version: 1,
    assistantName,
    enabled,
    applicationScope,
    lockScreenChatEnabled,
    updatedAt:
      typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
  };
}

export function loadAIConfig(): PersonalizedAIConfig {
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_CONFIG };
    return sanitizeAIConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function saveAIConfig(config: PersonalizedAIConfig): PersonalizedAIConfig {
  const sanitized = sanitizeAIConfig({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  try {
    window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota errors
  }
  return sanitized;
}
