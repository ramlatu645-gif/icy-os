/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import {
  AICapabilityPermissions,
  PersonalizedAIConfig,
  TimeFormatOption,
} from '../../types/launcher';
import { useLiveClock } from '../../hooks/useLiveClock';
import { icyAIService } from '../../services/icyAIService';

import { WallpaperBackground } from '../common/WallpaperBackground';

interface LockScreenProps {
  timeFormat: TimeFormatOption;
  displaySizeScale: number;
  wallpaper?: string;
  aiConfig: PersonalizedAIConfig;
  aiPermissions: AICapabilityPermissions;
  onRequestUnlock: () => void;
}

/**
 * Minimal, full-screen launcher lock screen.
 * Contains ONLY:
 * 1. Large live digital clock
 * 2. Current date
 * 3. Welcome message: "Hey buddy, unlock this launcher to explore your ICY apps."
 * 4. Small subtle instruction underneath: "Tap to unlock"
 *
 * When the optional Lock-Screen AI Chat setting is explicitly enabled by the user,
 * provides a subtle trigger to open a restricted pre-unlock assistant interaction
 * that never exposes private user info, private app content, or executes actions.
 */
export const LockScreen: React.FC<LockScreenProps> = ({
  timeFormat,
  displaySizeScale,
  wallpaper = '',
  aiConfig,
  aiPermissions,
  onRequestUnlock,
}) => {
  const clock = useLiveClock(timeFormat);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const canShowLockScreenChatOption =
    aiConfig.lockScreenChatEnabled && aiPermissions.chatAndAssistance;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (isChatModalOpen) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRequestUnlock();
    }
  };

  const handleSendLockedChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim() || isSending) return;

    setIsSending(true);
    setChatError(null);
    setChatResponse(null);

    try {
      const res = await icyAIService.sendAssistanceRequest({
        prompt: chatPrompt,
        config: aiConfig,
        permissions: aiPermissions,
        isLauncherLocked: true,
      });

      if (res.deliveredToBackend && res.reply) {
        setChatResponse(res.reply);
      } else {
        setChatError(res.errorReason);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <WallpaperBackground wallpaper={wallpaper} blur={true}>
      <main
        role="button"
        tabIndex={0}
        aria-label="ICOS locked. Tap or press Enter to unlock."
        onClick={() => {
          if (!isChatModalOpen) {
            onRequestUnlock();
          }
        }}
        onKeyDown={handleKeyDown}
        style={{
          padding: `${Math.round(24 * displaySizeScale)}px`,
        }}
        className="min-h-dvh w-full flex flex-col items-center justify-center select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-[var(--icy-border-focus)] transition-colors relative"
      >
      <div
        style={{
          gap: `${Math.round(32 * displaySizeScale)}px`,
        }}
        className="w-full max-w-xl flex flex-col items-center text-center bg-black/40 backdrop-blur-2xl border border-white/15 p-8 sm:p-12 rounded-3xl shadow-2xl"
      >
        {/* 1. Large live digital clock & 2. Current date */}
        <div className="flex flex-col items-center">
          <time
            dateTime={clock.isoTimestamp}
            className="tabular-clock leading-none text-6xl sm:text-7xl md:text-8xl flex items-baseline justify-center"
          >
            <span className="text-white font-extralight tracking-tight drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]">
              {clock.hoursMinutes}
            </span>
            {clock.period ? (
              <span className="ml-3 text-3xl sm:text-4xl md:text-5xl font-light text-cyan-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                {clock.period}
              </span>
            ) : null}
          </time>

          <p className="mt-4 text-base sm:text-lg text-blue-100/90 font-medium tracking-widest uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            {clock.shortDateText}
          </p>
        </div>

        {/* 3. Welcome message */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-normal text-white leading-snug max-w-[16ch] [text-wrap:balance] drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
          Unlock ICOS to access your apps.
        </h1>

        {/* 4. Small subtle instruction underneath */}
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRequestUnlock();
          }}
          className="inline-flex items-center justify-center min-h-[48px] px-6 py-2.5 text-sm sm:text-base font-medium text-white bg-blue-600/40 hover:bg-blue-600/70 backdrop-blur-xl border border-blue-400/40 hover:border-blue-400 rounded-full shadow-xl transition-all hover:scale-105 cursor-pointer"
        >
          Tap to unlock
        </span>
      </div>

      {/* Optional Lock-Screen AI Chat trigger (shown ONLY when explicitly enabled in Settings/Setup) */}
      {canShowLockScreenChatOption && !isChatModalOpen ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-10"
        >
          <button
            type="button"
            onClick={() => setIsChatModalOpen(true)}
            aria-label={`Ask ${aiConfig.assistantName} (Lock screen restricted mode)`}
            className="min-h-[44px] px-4 py-2 rounded-full bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] text-xs sm:text-sm text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            <span>Ask {aiConfig.assistantName}</span>
          </button>
        </div>
      ) : null}

      {/* Restricted Pre-Unlock Chat Overlay */}
      {isChatModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${aiConfig.assistantName} lock-screen restricted chat`}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-4 cursor-default select-text"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] p-5 flex flex-col gap-4 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col text-left">
                <h2 className="text-base font-medium text-[var(--icy-text-primary)]">
                  {aiConfig.assistantName}
                </h2>
                <span className="text-xs text-[var(--icy-text-muted)]">
                  Locked mode · Private account &amp; app data hidden
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsChatModalOpen(false);
                  setChatPrompt('');
                  setChatResponse(null);
                  setChatError(null);
                }}
                aria-label="Close lock-screen chat"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {chatResponse ? (
              <div className="p-3.5 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-sm text-[var(--icy-text-primary)] text-left leading-relaxed">
                {chatResponse}
              </div>
            ) : null}

            {chatError ? (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-[var(--icy-danger-border)] bg-[var(--icy-danger-bg)] text-[var(--icy-danger-text)] text-xs sm:text-sm text-left"
              >
                {chatError}
              </div>
            ) : null}

            <form onSubmit={handleSendLockedChat} className="flex items-center gap-2">
              <label htmlFor="lockscreen-ai-input" className="sr-only">
                Ask {aiConfig.assistantName} a general question
              </label>
              <input
                id="lockscreen-ai-input"
                type="text"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                placeholder={`Ask ${aiConfig.assistantName}...`}
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-sm text-[var(--icy-text-primary)] placeholder:text-[var(--icy-text-muted)] focus:outline-none focus:border-[var(--icy-border-focus)]"
              />
              <button
                type="submit"
                disabled={isSending || !chatPrompt.trim()}
                aria-label="Send question"
                className="min-w-[44px] min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--icy-accent-primary)] text-[var(--icy-accent-text)] flex items-center justify-center disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
    </WallpaperBackground>
  );
};
