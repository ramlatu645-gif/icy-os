/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import {
  AIApplicationScope,
  AICapabilityPermissions,
  IcyServiceStatusRecord,
  PersonalizedAIConfig,
  SetupStepId,
} from '../../types/launcher';
import { validateAssistantName } from '../../storage/aiConfigStorage';

import { WallpaperBackground } from '../common/WallpaperBackground';

interface SetupFlowScreenProps {
  currentStep: SetupStepId;
  displaySizeScale: number;
  wallpaper?: string;
  aiConfig: PersonalizedAIConfig;
  aiPermissions: AICapabilityPermissions;
  serviceStatus: IcyServiceStatusRecord;
  onChangeStep: (step: SetupStepId) => void;
  onUpdateAIConfig: (updater: (prev: PersonalizedAIConfig) => PersonalizedAIConfig) => void;
  onUpdateAIPermissions: (
    updater: (prev: AICapabilityPermissions) => AICapabilityPermissions
  ) => void;
  onExecuteSetUpLauncher: () => Promise<{
    localInitialized: boolean;
    serviceStatus: IcyServiceStatusRecord;
  }>;
  onEnterLauncher: () => void;
}

const SCOPE_OPTIONS: {
  id: AIApplicationScope;
  title: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    id: 'official-only',
    title: 'Official ICY applications only',
    description:
      'Allow your ICY AI to work through compatible official ICY applications.',
    recommended: true,
  },
  {
    id: 'third-party-only',
    title: 'Compatible third-party applications only',
    description:
      'Allow your ICY AI to work through compatible third-party applications that explicitly support ICY AI integration.',
  },
  {
    id: 'both',
    title: 'Both',
    description:
      'Allow your ICY AI to work through compatible official ICY applications and supported third-party applications.',
  },
];

export const SetupFlowScreen: React.FC<SetupFlowScreenProps> = ({
  currentStep,
  displaySizeScale,
  wallpaper = '',
  aiConfig,
  aiPermissions,
  serviceStatus,
  onChangeStep,
  onUpdateAIConfig,
  onUpdateAIPermissions,
  onExecuteSetUpLauncher,
  onEnterLauncher,
}) => {
  const [assistantNameInput, setAssistantNameInput] = useState(
    aiConfig.assistantName
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [isInitializingLauncher, setIsInitializingLauncher] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    setAssistantNameInput(aiConfig.assistantName);
  }, [aiConfig.assistantName]);

  const handleSaveAssistantNameAndContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAssistantName(assistantNameInput);
    if (!validation.valid) {
      setNameError(validation.error || 'Please enter a valid assistant name.');
      return;
    }
    setNameError(null);
    onUpdateAIConfig((prev) => ({
      ...prev,
      assistantName: validation.normalized,
    }));
    onChangeStep('ai-scope');
  };

  const handleSetUpLauncherClick = async () => {
    setInitError(null);
    const validation = validateAssistantName(aiConfig.assistantName);
    if (!validation.valid) {
      setInitError(validation.error || 'Invalid assistant name.');
      return;
    }

    setIsInitializingLauncher(true);
    try {
      const result = await onExecuteSetUpLauncher();
      if (result.localInitialized) {
        onChangeStep('completed');
      } else {
        setInitError('Local launcher initialization encountered an error.');
      }
    } catch {
      setInitError('Failed to initialize launcher preferences.');
    } finally {
      setIsInitializingLauncher(false);
    }
  };

  const pad = Math.round(24 * displaySizeScale);

  // ---------------------------------------------------------------------------
  // STEP 1: WELCOME TO IC APP LAUNCHER
  // ---------------------------------------------------------------------------
  if (currentStep === 'welcome') {
    return (
      <main
        style={{ padding: `${pad}px` }}
        className="min-h-dvh w-full flex flex-col items-center justify-center text-center"
      >
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-[var(--icy-text-primary)] [text-wrap:balance]">
              Welcome to ICOS
            </h1>
            <p className="text-base sm:text-lg text-[var(--icy-text-secondary)]">
              A simple application launcher for ICY applications and compatible third-party applications.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onChangeStep('ai-personalization')}
            className="w-full max-w-xs min-h-[52px] px-6 py-3 rounded-full bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] font-medium text-base shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--icy-border-focus)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Get started
          </button>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 2: PERSONALIZE THE USER'S ICY AI ASSISTANT
  // ---------------------------------------------------------------------------
  if (currentStep === 'ai-personalization') {
    return (
      <main
        style={{ padding: `${pad}px` }}
        className="min-h-dvh w-full flex flex-col items-center justify-center"
      >
        <div className="w-full max-w-lg flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChangeStep('welcome')}
              aria-label="Back to welcome screen"
              className="min-w-[44px] min-h-[44px] -ml-2 p-2 rounded-full text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] hover:bg-[var(--icy-bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] transition-colors flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-xs font-medium tracking-wider text-[var(--icy-text-muted)]">
              Step 1 of 4
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-[var(--icy-text-primary)]">
              Meet your ICY AI
            </h1>
            <p className="text-sm sm:text-base text-[var(--icy-text-secondary)] leading-relaxed">
              Give your assistant a name and choose how it can help you.
            </p>
          </div>

          <form
            onSubmit={handleSaveAssistantNameAndContinue}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label
                htmlFor="setup-ai-assistant-name"
                className="text-sm font-medium text-[var(--icy-text-primary)]"
              >
                Name your ICY AI
              </label>
              <input
                id="setup-ai-assistant-name"
                type="text"
                value={assistantNameInput}
                onChange={(e) => {
                  setAssistantNameInput(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Enter your assistant's name"
                maxLength={40}
                autoComplete="off"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] placeholder:text-[var(--icy-text-muted)] text-base focus:outline-none focus:border-[var(--icy-border-focus)]"
              />
            </div>

            {nameError ? (
              <div
                role="alert"
                className="px-4 py-2.5 rounded-xl border border-[var(--icy-danger-border)] bg-[var(--icy-danger-bg)] text-[var(--icy-danger-text)] text-xs sm:text-sm"
              >
                {nameError}
              </div>
            ) : null}

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] font-medium text-sm sm:text-base transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 5: CHOOSE WHICH APPLICATIONS THE ICY AI CAN WORK WITH
  // ---------------------------------------------------------------------------
  if (currentStep === 'ai-scope') {
    return (
      <main
        style={{ padding: `${pad}px` }}
        className="min-h-dvh w-full flex flex-col items-center justify-center"
      >
        <div className="w-full max-w-lg flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChangeStep('ai-personalization')}
              aria-label="Back to assistant name step"
              className="min-w-[44px] min-h-[44px] -ml-2 p-2 rounded-full text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] hover:bg-[var(--icy-bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] transition-colors flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-xs font-medium tracking-wider text-[var(--icy-text-muted)]">
              Step 2 of 4
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-[var(--icy-text-primary)]">
              Choose application access scope
            </h1>
            <p className="text-sm sm:text-base text-[var(--icy-text-secondary)] leading-relaxed">
              Select which categories of integrated applications {aiConfig.assistantName} may work with when an application provides a verified adapter and you grant permission.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="ICY AI application access scope"
            className="flex flex-col gap-3"
          >
            {SCOPE_OPTIONS.map((opt) => {
              const isSelected = aiConfig.applicationScope === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() =>
                    onUpdateAIConfig((prev) => ({
                      ...prev,
                      applicationScope: opt.id,
                    }))
                  }
                  className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer flex items-start justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                    isSelected
                      ? 'bg-[var(--icy-bg-surface)] border-[var(--icy-border-focus)]'
                      : 'bg-transparent border-[var(--icy-border-subtle)] hover:bg-[var(--icy-bg-surface)]/60'
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-medium text-[var(--icy-text-primary)]">
                        {opt.title}
                      </span>
                      {opt.recommended ? (
                        <span className="text-xs text-[var(--icy-text-muted)]">
                          · Recommended
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--icy-text-secondary)] leading-relaxed">
                      {opt.description}
                    </p>
                  </div>

                  <span
                    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)] text-[var(--icy-accent-text)]'
                        : 'border-[var(--icy-border-subtle)]'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={() => onChangeStep('ai-permissions')}
              className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] font-medium text-sm sm:text-base transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Continue
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 4: REVIEW AND APPROVE AI MODES & PERMISSIONS
  // ---------------------------------------------------------------------------
  if (currentStep === 'ai-permissions') {
    return (
      <main
        style={{ padding: `${pad}px` }}
        className="min-h-dvh w-full flex flex-col items-center justify-center"
      >
        <div className="w-full max-w-lg flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChangeStep('ai-scope')}
              aria-label="Back to application scope step"
              className="min-w-[44px] min-h-[44px] -ml-2 p-2 rounded-full text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] hover:bg-[var(--icy-bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] transition-colors flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-xs font-medium tracking-wider text-[var(--icy-text-muted)]">
              Step 3 of 4
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-[var(--icy-text-primary)]">
              Review AI permissions
            </h1>
            <p className="text-sm sm:text-base text-[var(--icy-text-secondary)] leading-relaxed">
              Sensitive capabilities are disabled by default. {aiConfig.assistantName} can only use capabilities that you explicitly grant below.
            </p>
          </div>

          <div className="flex flex-col divide-y divide-[var(--icy-border-subtle)] border-y border-[var(--icy-border-subtle)]">
            {/* Capability A: Chat and assistance */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium text-[var(--icy-text-primary)]">
                  Chat and assistance
                </span>
                <p className="text-xs sm:text-sm text-[var(--icy-text-secondary)] leading-relaxed">
                  Allow {aiConfig.assistantName} to answer questions and provide general assistance through supported ICY AI interfaces. Does not authorize reading private application content.
                </p>
                <span className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                  State: {aiPermissions.chatAndAssistance ? 'Granted' : 'Denied'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiPermissions.chatAndAssistance}
                aria-label="Chat and assistance permission"
                onClick={() =>
                  onUpdateAIPermissions((prev) => ({
                    ...prev,
                    chatAndAssistance: !prev.chatAndAssistance,
                  }))
                }
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                  aiPermissions.chatAndAssistance
                    ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                    : 'bg-transparent border-[var(--icy-text-muted)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                    aiPermissions.chatAndAssistance
                      ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                      : 'translate-x-1 bg-[var(--icy-text-muted)]'
                  }`}
                />
              </button>
            </div>

            {/* Capability B: Application context access */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium text-[var(--icy-text-primary)]">
                  Application context access
                </span>
                <p className="text-xs sm:text-sm text-[var(--icy-text-secondary)] leading-relaxed">
                  Allow {aiConfig.assistantName} to read selected context shared by an integrated application within your chosen scope only when that application provides a verified context adapter.
                </p>
                <span className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                  State: {aiPermissions.applicationContextAccess ? 'Granted' : 'Disabled (Default)'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiPermissions.applicationContextAccess}
                aria-label="Application context access permission"
                onClick={() =>
                  onUpdateAIPermissions((prev) => ({
                    ...prev,
                    applicationContextAccess: !prev.applicationContextAccess,
                  }))
                }
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                  aiPermissions.applicationContextAccess
                    ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                    : 'bg-transparent border-[var(--icy-text-muted)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                    aiPermissions.applicationContextAccess
                      ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                      : 'translate-x-1 bg-[var(--icy-text-muted)]'
                  }`}
                />
              </button>
            </div>

            {/* Capability C: Application actions */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium text-[var(--icy-text-primary)]">
                  Application actions
                </span>
                <p className="text-xs sm:text-sm text-[var(--icy-text-secondary)] leading-relaxed">
                  Allow {aiConfig.assistantName} to perform supported actions in integrated applications through explicit registered adapters. Sensitive actions always require your confirmation.
                </p>
                <span className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                  State: {aiPermissions.applicationActions ? 'Granted (Confirmation required)' : 'Disabled (Default)'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiPermissions.applicationActions}
                aria-label="Application actions permission"
                onClick={() =>
                  onUpdateAIPermissions((prev) => ({
                    ...prev,
                    applicationActions: !prev.applicationActions,
                  }))
                }
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                  aiPermissions.applicationActions
                    ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                    : 'bg-transparent border-[var(--icy-text-muted)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                    aiPermissions.applicationActions
                      ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                      : 'translate-x-1 bg-[var(--icy-text-muted)]'
                  }`}
                />
              </button>
            </div>

            {/* Optional Lock-Screen AI Chat */}
            <div className="py-4 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium text-[var(--icy-text-primary)]">
                  Lock-screen AI chat
                </span>
                <p className="text-xs sm:text-sm text-[var(--icy-text-secondary)] leading-relaxed">
                  Optional setting allowing restricted general chat on the lock screen before unlocking. Never reveals private data, application content, or executes actions while locked.
                </p>
                <span className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                  State: {aiConfig.lockScreenChatEnabled ? 'Enabled (Restricted public mode)' : 'Disabled (Default)'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiConfig.lockScreenChatEnabled}
                aria-label="Allow restricted AI chat on lock screen"
                onClick={() =>
                  onUpdateAIConfig((prev) => ({
                    ...prev,
                    lockScreenChatEnabled: !prev.lockScreenChatEnabled,
                  }))
                }
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                  aiConfig.lockScreenChatEnabled
                    ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                    : 'bg-transparent border-[var(--icy-text-muted)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                    aiConfig.lockScreenChatEnabled
                      ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                      : 'translate-x-1 bg-[var(--icy-text-muted)]'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={() => onChangeStep('finalize-setup')}
              className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] font-medium text-sm sm:text-base transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Review summary
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 5: FINALIZE ("EVERYTHING IS READY" -> "FINISH SETUP")
  // ---------------------------------------------------------------------------
  if (currentStep === 'finalize-setup') {
    const scopeLabel =
      SCOPE_OPTIONS.find((s) => s.id === aiConfig.applicationScope)?.title ??
      aiConfig.applicationScope;

    return (
      <main
        style={{ padding: `${pad}px` }}
        className="min-h-dvh w-full flex flex-col items-center justify-center"
      >
        <div className="w-full max-w-lg flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChangeStep('ai-permissions')}
              aria-label="Back to AI permissions step"
              className="min-w-[44px] min-h-[44px] -ml-2 p-2 rounded-full text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] hover:bg-[var(--icy-bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] transition-colors flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-xs font-medium tracking-wider text-[var(--icy-text-muted)]">
              Step 4 of 4
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-[var(--icy-text-primary)]">
              Everything is ready
            </h1>
            <p className="text-sm sm:text-base text-[var(--icy-text-secondary)] leading-relaxed">
              Personalize your ICOS experience.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--icy-text-secondary)]">Assistant name</span>
              <span className="text-[var(--icy-text-primary)] font-medium">
                {aiConfig.assistantName}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--icy-text-secondary)]">Application scope</span>
              <span className="text-[var(--icy-text-primary)] font-medium text-right">
                {scopeLabel}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--icy-text-secondary)]">Granted capabilities</span>
              <span className="text-[var(--icy-text-primary)] font-medium text-right">
                {[
                  aiPermissions.chatAndAssistance ? 'Chat' : null,
                  aiPermissions.applicationContextAccess ? 'Context' : null,
                  aiPermissions.applicationActions ? 'Actions' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'None'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--icy-text-secondary)]">Lock-screen chat</span>
              <span className="text-[var(--icy-text-primary)] font-medium">
                {aiConfig.lockScreenChatEnabled ? 'Enabled (Restricted)' : 'Disabled'}
              </span>
            </div>
          </div>

          {initError ? (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-xl border border-[var(--icy-danger-border)] bg-[var(--icy-danger-bg)] text-[var(--icy-danger-text)] text-xs sm:text-sm"
            >
              {initError}
            </div>
          ) : null}

          <button
            type="button"
            disabled={isInitializingLauncher}
            onClick={() => void handleSetUpLauncherClick()}
            className="w-full min-h-[52px] px-6 py-3 rounded-full bg-[var(--icy-accent-primary)] text-[var(--icy-accent-text)] font-medium text-base hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
          >
            {isInitializingLauncher ? 'Setting up...' : 'Finish setup'}
          </button>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 6: COMPLETION SCREEN ("IC App Launcher is ready." -> "Enter launcher")
  // ---------------------------------------------------------------------------
  return (
    <main
      style={{ padding: `${pad}px` }}
      className="min-h-dvh w-full flex flex-col items-center justify-center text-center"
    >
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="w-14 h-14 rounded-full bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] flex items-center justify-center">
          <ShieldCheck
            className="w-7 h-7 text-[var(--icy-text-primary)]"
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-[var(--icy-text-primary)]">
            ICOS is ready.
          </h1>
          <p className="text-base text-[var(--icy-text-secondary)]">
            Your launcher is set up and ready to use.
          </p>
        </div>

        {/* Truthful summary of local vs optional online service status */}
        <div className="w-full p-4 rounded-2xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] flex flex-col gap-2 text-xs sm:text-sm text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--icy-text-secondary)]">Local launcher</span>
            <span className="text-[var(--icy-text-primary)] font-medium">Initialized</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--icy-text-secondary)]">ICY Service</span>
            <span className="text-[var(--icy-text-primary)]">
              {serviceStatus.status === 'connected'
                ? 'Connected'
                : 'ICY Service not connected'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--icy-text-secondary)]">{aiConfig.assistantName}</span>
            <span className="text-[var(--icy-text-primary)]">
              {serviceStatus.status === 'connected'
                ? 'Ready'
                : 'ICY AI unavailable (Local preferences saved)'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onEnterLauncher}
          className="w-full max-w-xs min-h-[52px] px-6 py-3 rounded-full bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] font-medium text-base shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Enter launcher
        </button>
      </div>
    </main>
  );
};
