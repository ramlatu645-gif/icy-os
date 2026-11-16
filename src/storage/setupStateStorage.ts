/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FirstRunSetupState, SetupStepId } from '../types/launcher';

const SETUP_STATE_STORAGE_KEY = 'ic_app_launcher_first_run_setup_state_v1';

const VALID_STEPS: SetupStepId[] = [
  'welcome',
  'ai-personalization',
  'ai-scope',
  'ai-permissions',
  'finalize-setup',
  'completed',
];

export const DEFAULT_SETUP_STATE: FirstRunSetupState = {
  version: 1,
  isCompleted: false,
  currentStep: 'welcome',
  completedAt: null,
};

export function sanitizeSetupState(raw: unknown): FirstRunSetupState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETUP_STATE };
  }
  const obj = raw as Record<string, unknown>;
  const isCompleted = obj.isCompleted === true;
  const currentStep: SetupStepId =
    typeof obj.currentStep === 'string' &&
    VALID_STEPS.includes(obj.currentStep as SetupStepId)
      ? (obj.currentStep as SetupStepId)
      : isCompleted
      ? 'completed'
      : 'welcome';

  const completedAt =
    isCompleted && typeof obj.completedAt === 'string'
      ? obj.completedAt
      : isCompleted
      ? new Date().toISOString()
      : null;

  return {
    version: 1,
    isCompleted,
    currentStep,
    completedAt,
  };
}

export function loadSetupState(): FirstRunSetupState {
  try {
    const raw = window.localStorage.getItem(SETUP_STATE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETUP_STATE };
    return sanitizeSetupState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETUP_STATE };
  }
}

export function saveSetupState(state: FirstRunSetupState): FirstRunSetupState {
  const sanitized = sanitizeSetupState(state);
  try {
    window.localStorage.setItem(SETUP_STATE_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota issues
  }
  return sanitized;
}

export function updateSetupStep(step: SetupStepId): FirstRunSetupState {
  const current = loadSetupState();
  return saveSetupState({
    ...current,
    currentStep: step,
  });
}

export function markSetupCompleted(): FirstRunSetupState {
  return saveSetupState({
    version: 1,
    isCompleted: true,
    currentStep: 'completed',
    completedAt: new Date().toISOString(),
  });
}
