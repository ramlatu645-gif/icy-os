/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft, BookOpen, Search, Lock, Settings, ShieldCheck, Zap } from 'lucide-react';
import { LauncherPreferences } from '../../types/launcher';

interface HelpScreenProps {
  preferences: LauncherPreferences;
  onBackToHome: () => void;
}

export const HelpScreen: React.FC<HelpScreenProps> = ({ preferences, onBackToHome }) => {
  const scale = preferences.displaySizeScale;

  const helpTopics = [
    {
      icon: Search,
      title: 'Searching Apps',
      content: 'Use the launcher search to quickly find and launch your installed applications. Press Esc to clear search.'
    },
    {
      icon: Lock,
      title: 'Security',
      content: 'Enable password protection in Settings to lock your launcher. Your password is stored locally as a secure hash.'
    },
    {
      icon: Settings,
      title: 'Customization',
      content: 'Change your theme, adjust display and font sizes, or toggle desktop components like the taskbar and AI Operator in Settings.'
    },
    {
      icon: ShieldCheck,
      title: 'Account & Privacy',
      content: 'Link your ICY Account to access authorized services and sync your preferences securely. Your credentials remain private.'
    },
    {
      icon: Zap,
      title: 'ICY AI',
      content: 'Personalize your AI assistant and define application access scopes in the Settings menu to control how your assistant interacts with your ICY environment.'
    }
  ];

  return (
    <main
      style={{
        paddingTop: `${Math.round(32 * scale)}px`,
        paddingBottom: `${Math.round(64 * scale)}px`,
        paddingLeft: `${Math.round(24 * scale)}px`,
        paddingRight: `${Math.round(24 * scale)}px`,
      }}
      className="min-h-dvh w-full flex flex-col items-center bg-[var(--icy-bg-canvas)]"
    >
      <div className="w-full max-w-xl flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={onBackToHome}
            aria-label="Back to launcher home screen"
            className="min-w-[44px] min-h-[44px] -ml-2 p-2 rounded-full text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] hover:bg-[var(--icy-bg-surface)] transition-colors flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--icy-text-primary)] flex items-center gap-3">
            <BookOpen className="w-8 h-8" />
            Help &amp; Guidance
          </h1>
        </div>

        <div className="flex flex-col gap-6">
          {helpTopics.map((topic, i) => (
            <div key={i} className="p-5 rounded-2xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] flex items-start gap-4">
              <div className="mt-1 p-2 rounded-lg bg-[var(--icy-bg-input)] text-[var(--icy-accent-primary)]">
                <topic.icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-medium text-[var(--icy-text-primary)]">{topic.title}</h3>
                <p className="text-sm text-[var(--icy-text-secondary)] leading-relaxed">{topic.content}</p>
              </div>
            </div>
          ))}
        </div>
        
        <p className="mt-8 text-xs text-[var(--icy-text-muted)] text-center">
            For further support, please visit the official ICY help portal through your browser.
        </p>
      </div>
    </main>
  );
};
