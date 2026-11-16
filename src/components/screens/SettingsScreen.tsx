/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Key,
  Layers,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  User,
  Smartphone,
  Trash2,
  Info,
  X,
} from 'lucide-react';
import {
  AIApplicationScope,
  AICapabilityPermissions,
  IcyAccountConnectionStatus,
  IcyAccountSessionRecord,
  IcyServiceStatusRecord,
  LauncherPreferences,
  PersonalizedAIConfig,
  RegisteredApplication,
  ThemeOption,
  TimeFormatOption,
} from '../../types/launcher';
import { THEME_OPTIONS } from '../../theme/themeManager';
import { validateAssistantName } from '../../storage/aiConfigStorage';
import { WALLPAPER_PRESETS } from '../../utils/wallpapers';
import { WallpaperBackground } from '../common/WallpaperBackground';

interface SettingsScreenProps {
  preferences: LauncherPreferences;
  hasConfiguredPassword: boolean;
  aiConfig: PersonalizedAIConfig;
  aiPermissions: AICapabilityPermissions;
  serviceStatus: IcyServiceStatusRecord;
  accountSession?: IcyAccountSessionRecord;
  officialApps?: RegisteredApplication[];
  installedApps: RegisteredApplication[];
  onUpdatePreferences: (
    updater: (prev: LauncherPreferences) => LauncherPreferences
  ) => void;
  onCreatePassword: (newPassword: string) => Promise<void>;
  onChangePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  onDisablePassword: (
    currentPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  onLockLauncherImmediately: () => void;
  onUpdateAIConfig: (
    updater: (prev: PersonalizedAIConfig) => PersonalizedAIConfig
  ) => void;
  onUpdateAIPermissions: (
    updater: (prev: AICapabilityPermissions) => AICapabilityPermissions
  ) => void;
  onSubmitPlatformApiKey: (
    apiKey: string
  ) => Promise<{ accepted: boolean; record: IcyServiceStatusRecord }>;
  onVerifyPlatformConnection: () => Promise<IcyServiceStatusRecord>;
  onDisconnectPlatformKey: () => Promise<IcyServiceStatusRecord>;
  onStartAccountAuth?: () => Promise<{ success: boolean; authUrl?: string; error?: string }>;
  onSignOutAccount?: () => Promise<IcyAccountSessionRecord>;
  onVerifyAccountSession?: () => Promise<IcyAccountSessionRecord>;
  onRequestDelegatedToken?: (appId: string) => Promise<unknown>;
  onUninstallApp?: (appId: string) => void;
  onOpenHelp?: () => void;
  onBackToHome: () => void;
}

type SecurityFlowMode = 'idle' | 'create' | 'change' | 'disable';

const SCOPE_CHOICES: {
  id: AIApplicationScope;
  title: string;
  description: string;
}[] = [
  {
    id: 'official-only',
    title: 'Official ICY applications only',
    description:
      'Allow your ICY AI to work through compatible official ICY applications.',
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

function formatConnectionStatusLabel(
  status: IcyServiceStatusRecord['status'] | IcyAccountConnectionStatus
): string {
  switch (status) {
    case 'not-configured':
      return 'Not configured';
    case 'not-connected':
      return 'Not connected';
    case 'awaiting-authorization':
      return 'Awaiting account authorization';
    case 'connecting':
      return 'Connecting';
    case 'authenticated':
      return 'Authenticated';
    case 'connected':
      return 'Connected to the account service';
    case 'session-expired':
      return 'Session expired';
    case 'offline':
      return 'Offline';
    case 'authentication-failed':
      return 'Authentication failed';
    case 'insufficient-permissions':
      return 'Insufficient permissions';
    case 'service-unavailable':
      return 'Service unavailable';
    default:
      return 'Not connected';
  }
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  preferences,
  hasConfiguredPassword,
  aiConfig,
  aiPermissions,
  serviceStatus,
  accountSession,
  officialApps = [],
  installedApps,
  onUpdatePreferences,
  onCreatePassword,
  onChangePassword,
  onDisablePassword,
  onLockLauncherImmediately,
  onUpdateAIConfig,
  onUpdateAIPermissions,
  onSubmitPlatformApiKey,
  onVerifyPlatformConnection,
  onDisconnectPlatformKey,
  onStartAccountAuth,
  onSignOutAccount,
  onVerifyAccountSession,
  onRequestDelegatedToken,
  onUninstallApp,
  onOpenHelp,
  onBackToHome,
}) => {
  // Password security state
  const [securityMode, setSecurityMode] = useState<SecurityFlowMode>('idle');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityFeedback, setSecurityFeedback] = useState<string | null>(null);
  const [isSubmittingSecurity, setIsSubmittingSecurity] = useState(false);

  // AI assistant name editing state
  const [assistantNameDraft, setAssistantNameDraft] = useState(
    aiConfig.assistantName
  );
  const [assistantNameFeedback, setAssistantNameFeedback] = useState<string | null>(
    null
  );
  const [assistantNameError, setAssistantNameError] = useState<string | null>(
    null
  );

  // ICY Service API key state (asks ONLY for the ICY application API key, never a URL)
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingService, setIsTestingService] = useState(false);
  const [serviceActionFeedback, setServiceActionFeedback] = useState<string | null>(
    null
  );

  // ICY Account authentication and Official Apps panel state
  const [isAuthorizingAccount, setIsAuthorizingAccount] = useState(false);
  const [accountActionFeedback, setAccountActionFeedback] = useState<string | null>(null);
  const [showOfficialAppsPanel, setShowOfficialAppsPanel] = useState(false);
  const [officialAppsQuery, setOfficialAppsQuery] = useState('');
  const [delegatedTokenPreview, setDelegatedTokenPreview] = useState<{
    appId: string;
    tokenSummary: string;
    permissions: string[];
  } | null>(null);

  const [selectedInstalledApp, setSelectedInstalledApp] = useState<RegisteredApplication | null>(null);

  const primaryThemes = THEME_OPTIONS.slice(0, 5);
  const additionalThemes = THEME_OPTIONS.slice(5);

  const resetSecurityForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
    setSecurityError(null);
  };

  const handleTogglePasswordSwitch = () => {
    setSecurityFeedback(null);
    resetSecurityForm();
    if (!hasConfiguredPassword) {
      setSecurityMode((prev) => (prev === 'create' ? 'idle' : 'create'));
    } else {
      setSecurityMode((prev) => (prev === 'disable' ? 'idle' : 'disable'));
    }
  };

  const handleSelectTheme = (theme: ThemeOption) => {
    onUpdatePreferences((prev) => ({
      ...prev,
      theme,
    }));
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onUpdatePreferences((prev) => ({
      ...prev,
      fontSizeScale: val,
    }));
  };

  const handleDisplaySizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onUpdatePreferences((prev) => ({
      ...prev,
      displaySizeScale: val,
    }));
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onUpdatePreferences((prev) => ({
      ...prev,
      localProfile: {
        ...prev.localProfile,
        displayName: value,
      },
    }));
  };

  const handleTimeFormatChange = (timeFormat: TimeFormatOption) => {
    onUpdatePreferences((prev) => ({
      ...prev,
      timeFormat,
    }));
  };

  const handleSecurityFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSecurityError(null);
    setSecurityFeedback(null);

    if (securityMode === 'create') {
      if (!newPassword || newPassword.length < 4) {
        setSecurityError('Please enter a password of at least 4 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSecurityError('The entered passwords do not match.');
        return;
      }

      setIsSubmittingSecurity(true);
      try {
        await onCreatePassword(newPassword);
        resetSecurityForm();
        setSecurityMode('idle');
        setSecurityFeedback('Launcher password protection enabled.');
      } catch {
        setSecurityError('Could not save password verifier.');
      } finally {
        setIsSubmittingSecurity(false);
      }
      return;
    }

    if (securityMode === 'change') {
      if (!currentPassword) {
        setSecurityError('Please enter your current password.');
        return;
      }
      if (!newPassword || newPassword.length < 4) {
        setSecurityError('Please enter a new password of at least 4 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSecurityError('The new passwords do not match.');
        return;
      }

      setIsSubmittingSecurity(true);
      try {
        const result = await onChangePassword(currentPassword, newPassword);
        if (!result.success) {
          setSecurityError(result.error || 'Current password is incorrect.');
          return;
        }
        resetSecurityForm();
        setSecurityMode('idle');
        setSecurityFeedback('Launcher password updated.');
      } finally {
        setIsSubmittingSecurity(false);
      }
      return;
    }

    if (securityMode === 'disable') {
      if (!currentPassword) {
        setSecurityError('Enter your current password to disable protection.');
        return;
      }

      setIsSubmittingSecurity(true);
      try {
        const result = await onDisablePassword(currentPassword);
        if (!result.success) {
          setSecurityError(result.error || 'Current password is incorrect.');
          return;
        }
        resetSecurityForm();
        setSecurityMode('idle');
        setSecurityFeedback('Launcher password protection disabled.');
      } finally {
        setIsSubmittingSecurity(false);
      }
    }
  };

  const handleSaveAssistantName = (e: React.FormEvent) => {
    e.preventDefault();
    setAssistantNameError(null);
    setAssistantNameFeedback(null);
    const validated = validateAssistantName(assistantNameDraft);
    if (!validated.valid) {
      setAssistantNameError(validated.error || 'Invalid assistant name.');
      return;
    }
    onUpdateAIConfig((prev) => ({
      ...prev,
      assistantName: validated.normalized,
    }));
    setAssistantNameFeedback('Assistant name saved.');
  };

  const handleSaveAndTestApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceActionFeedback(null);
    setIsTestingService(true);
    try {
      if (apiKeyInput.trim().length > 0) {
        const submitRes = await onSubmitPlatformApiKey(apiKeyInput);
        if (!submitRes.accepted) {
          return;
        }
        setApiKeyInput('');
      }
      await onVerifyPlatformConnection();
    } finally {
      setIsTestingService(false);
    }
  };

  const handleDisconnectApiKey = async () => {
    setIsTestingService(true);
    setServiceActionFeedback(null);
    try {
      await onDisconnectPlatformKey();
      setApiKeyInput('');
      setServiceActionFeedback('Application API credential removed from server.');
    } finally {
      setIsTestingService(false);
    }
  };

  const scale = preferences.displaySizeScale;

  return (
    <main
      style={{
        paddingTop: `${Math.round(32 * scale)}px`,
        paddingBottom: `${Math.round(64 * scale)}px`,
        paddingLeft: `${Math.round(24 * scale)}px`,
        paddingRight: `${Math.round(24 * scale)}px`,
      }}
      className="min-h-dvh w-full flex flex-col items-center"
    >
      <div className="w-full max-w-xl flex flex-col">
        {/* Top Back Control + Title */}
        <div className="flex items-center gap-3 mb-10">
          <button
            type="button"
            onClick={onBackToHome}
            aria-label="Back to launcher home screen"
            className="min-w-[48px] min-h-[48px] -ml-3 p-3 rounded-full text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] hover:bg-[var(--icy-bg-surface)] focus:outline-none transition-colors flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--icy-text-primary)]">
            Settings
          </h1>
        </div>

        {/* SECTION 1: APPEARANCE */}
        <section
          aria-labelledby="settings-appearance-heading"
          className="pb-8 border-b border-[var(--icy-border-subtle)]"
        >
          <h2
            id="settings-appearance-heading"
            className="text-xs font-semibold uppercase tracking-widest text-[var(--icy-text-muted)] mb-6"
          >
            Appearance
          </h2>

          <div
            role="radiogroup"
            aria-label="Primary launcher themes"
            className="grid grid-cols-5 gap-3 sm:gap-5 justify-items-center"
          >
            {primaryThemes.map((item) => {
              const isSelected = preferences.theme === item.id;
              const isLightSwatch = item.id === 'light';
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectTheme(item.id)}
                  className="group flex flex-col items-center gap-2.5 focus:outline-none cursor-pointer min-w-[56px]"
                >
                  <span
                    style={{
                      background: item.swatchColor,
                      borderColor: isSelected
                        ? 'var(--icy-text-primary)'
                        : item.swatchBorder || 'transparent',
                    }}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-[var(--icy-border-focus)] ${
                      isLightSwatch || isSelected ? 'border-2' : 'border'
                    }`}
                  >
                    {isSelected ? (
                      <Check
                        className={`w-6 h-6 stroke-[2.2] ${
                          isLightSwatch ? 'text-[#3A3832]' : 'text-white'
                        }`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <span className="text-sm text-[var(--icy-text-primary)] font-normal whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--icy-border-subtle)]/60">
            <p className="text-xs text-[var(--icy-text-muted)] mb-3">
              Additional themes &amp; system default
            </p>
            <div
              role="radiogroup"
              aria-label="Additional accent themes"
              className="grid grid-cols-4 gap-3 sm:gap-4 justify-items-center"
            >
              {additionalThemes.map((item) => {
                const isSelected = preferences.theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectTheme(item.id)}
                    className="group flex flex-col items-center gap-2 focus:outline-none cursor-pointer min-w-[56px]"
                  >
                    <span
                      style={{
                        background: item.swatchColor,
                        borderColor: isSelected
                          ? 'var(--icy-text-primary)'
                          : item.swatchBorder || 'transparent',
                      }}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-[var(--icy-border-focus)] ${
                        isSelected || item.swatchBorder ? 'border-2' : 'border'
                      }`}
                    >
                      {isSelected ? (
                        <Check
                          className="w-5 h-5 stroke-[2.2] text-white drop-shadow-xs"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                    <span className="text-xs sm:text-sm text-[var(--icy-text-secondary)] font-normal whitespace-nowrap">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Theme Color Picker */}
          <div className="mt-8 pt-6 border-t border-[var(--icy-border-subtle)]/60">
            <label className="text-xs text-[var(--icy-text-muted)] mb-3 block font-semibold uppercase tracking-wider">
              Display Accent Color
            </label>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)]">
              <div className="relative">
                <input
                  type="color"
                  id="settings-custom-color"
                  value={preferences.themeColor || '#1e70c1'}
                  onChange={(e) => {
                    onUpdatePreferences((prev) => ({
                      ...prev,
                      themeColor: e.target.value,
                    }));
                  }}
                  className="w-14 h-14 rounded-xl border-2 border-white/20 bg-transparent cursor-pointer overflow-hidden p-0 block"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-[var(--icy-text-primary)] font-bold">Custom Accent Color</span>
                <p className="text-[11px] text-[var(--icy-text-muted)] leading-tight">
                  This color will be applied to the taskbar, sidebar, search bar, and key UI elements across ICOS.
                </p>
                <span className="text-[10px] text-[var(--icy-accent-primary)] font-mono font-bold uppercase mt-1">
                  {preferences.themeColor || '#1E70C1'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: DESKTOP & ICY AI OPERATOR */}
        <section
          aria-labelledby="settings-desktop-heading"
          className="py-6 border-b border-[var(--icy-border-subtle)] flex flex-col gap-5"
        >
          <h2
            id="settings-desktop-heading"
            className="text-sm font-medium tracking-wider text-[var(--icy-text-secondary)]"
          >
            Desktop &amp; ICY AI Operator
          </h2>

          {/* Wallpaper Selection Gallery & Custom URL */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--icy-text-primary)]">
                Desktop Wallpaper
              </label>
              <button
                type="button"
                onClick={() =>
                  onUpdatePreferences((prev) => ({
                    ...prev,
                    wallpaper: 'linear-gradient(135deg, #0b0f19 0%, #111827 35%, #1e1b4b 70%, #0284c7 100%)',
                  }))
                }
                className="text-xs text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] underline cursor-pointer"
              >
                Reset to Default
              </button>
            </div>

            {/* Preset Thumbnails Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              {WALLPAPER_PRESETS.map((preset) => {
                const isSelected = preferences.wallpaper === preset.value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onUpdatePreferences((prev) => ({
                        ...prev,
                        wallpaper: preset.value,
                      }))
                    }
                    className={`group relative h-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer flex flex-col justify-end p-2 text-left ${
                      isSelected
                        ? 'border-[var(--icy-border-focus)] ring-2 ring-[var(--icy-border-focus)]/30 scale-[1.02]'
                        : 'border-[var(--icy-border-subtle)] hover:border-[var(--icy-text-secondary)]/50'
                    }`}
                    style={{ background: preset.previewCss }}
                  >
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-white drop-shadow-md truncate">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-[var(--icy-accent-primary)] text-[var(--icy-accent-text)] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom URL Input */}
            <div className="flex flex-col gap-1.5 pt-2">
              <label
                htmlFor="settings-wallpaper-url"
                className="text-xs text-[var(--icy-text-secondary)]"
              >
                Custom Wallpaper URL or CSS Gradient
              </label>
              <div className="flex gap-2">
                <input
                  id="settings-wallpaper-url"
                  type="text"
                  value={preferences.wallpaper}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdatePreferences((prev) => ({
                      ...prev,
                      wallpaper: val,
                    }));
                  }}
                  placeholder="https://... or linear-gradient(...)"
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] text-sm focus:outline-none focus:border-[var(--icy-border-focus)]"
                />
              </div>

              {/* Live Wallpaper Preview Box */}
              {preferences.wallpaper.trim().length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  <span className="text-[11px] text-[var(--icy-text-muted)] font-medium">
                    Live Wallpaper Preview
                  </span>
                  <div className="h-28 w-full rounded-2xl overflow-hidden border border-[var(--icy-border-subtle)] relative shadow-inner">
                    <WallpaperBackground wallpaper={preferences.wallpaper}>
                      <div className="w-full h-full flex items-center justify-center bg-black/20">
                        <span className="text-xs text-white/90 font-medium px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20">
                          Active Wallpaper
                        </span>
                      </div>
                    </WallpaperBackground>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-[var(--icy-text-muted)]">
                Supports HTTPS image links, base64 data URIs, or CSS linear/radial gradients.
              </p>
            </div>
          </div>

          {/* Taskbar Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-base text-[var(--icy-text-primary)]">
                Floating taskbar
              </span>
              <span className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                Show the horizontally centered application taskbar at the bottom.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.showTaskbar}
              aria-label="Show floating taskbar"
              onClick={() =>
                onUpdatePreferences((prev) => ({
                  ...prev,
                  showTaskbar: !prev.showTaskbar,
                }))
              }
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                preferences.showTaskbar
                  ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                  : 'bg-transparent border-[var(--icy-text-muted)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                  preferences.showTaskbar
                    ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                    : 'translate-x-1 bg-[var(--icy-text-muted)]'
                }`}
              />
            </button>
          </div>

          {/* Sidebar Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-base text-[var(--icy-text-primary)]">
                Quick-action sidebar
              </span>
              <span className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                Show the slim vertical action sidebar on the right side of the desktop.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.showSidebar}
              aria-label="Show quick-action sidebar"
              onClick={() =>
                onUpdatePreferences((prev) => ({
                  ...prev,
                  showSidebar: !prev.showSidebar,
                }))
              }
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                preferences.showSidebar
                  ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                  : 'bg-transparent border-[var(--icy-text-muted)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                  preferences.showSidebar
                    ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                    : 'translate-x-1 bg-[var(--icy-text-muted)]'
                }`}
              />
            </button>
          </div>

          {/* AI Operator Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-base text-[var(--icy-text-primary)]">
                ICY AI Operator logo
              </span>
              <span className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                Show the persistent AI Operator logo in the top-right corner of your desktop.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.aiOperatorEnabled}
              aria-label="Show ICY AI Operator"
              onClick={() =>
                onUpdatePreferences((prev) => ({
                  ...prev,
                  aiOperatorEnabled: !prev.aiOperatorEnabled,
                }))
              }
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                preferences.aiOperatorEnabled
                  ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                  : 'bg-transparent border-[var(--icy-text-muted)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                  preferences.aiOperatorEnabled
                    ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                    : 'translate-x-1 bg-[var(--icy-text-muted)]'
                }`}
              />
            </button>
          </div>
        </section>

        {/* SECTION 3: FONT SIZE */}
        <section
          aria-labelledby="settings-fontsize-heading"
          className="py-6 border-b border-[var(--icy-border-subtle)]"
        >
          <div className="flex items-center justify-between mb-4">
            <label
              id="settings-fontsize-heading"
              htmlFor="ic-launcher-font-size-slider"
              className="text-sm font-medium tracking-wider text-[var(--icy-text-secondary)]"
            >
              Font size
            </label>
            <span className="text-xs tabular-clock text-[var(--icy-text-muted)]">
              {Math.round(preferences.fontSizeScale * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-4 min-h-[44px]">
            <span
              className="text-base font-normal text-[var(--icy-text-primary)] select-none"
              aria-hidden="true"
            >
              A
            </span>
            <input
              id="ic-launcher-font-size-slider"
              type="range"
              min="0.85"
              max="1.25"
              step="0.05"
              value={preferences.fontSizeScale}
              onChange={handleFontSizeChange}
              aria-label="Font size scale"
              className="icy-slider flex-1"
            />
            <span
              className="text-2xl font-normal text-[var(--icy-text-primary)] select-none"
              aria-hidden="true"
            >
              A
            </span>
          </div>
        </section>

        {/* SECTION 3: DISPLAY SIZE */}
        <section
          aria-labelledby="settings-displaysize-heading"
          className="py-6 border-b border-[var(--icy-border-subtle)]"
        >
          <div className="flex items-center justify-between mb-4">
            <label
              id="settings-displaysize-heading"
              htmlFor="ic-launcher-display-size-slider"
              className="text-sm font-medium tracking-wider text-[var(--icy-text-secondary)]"
            >
              Display size
            </label>
            <span className="text-xs tabular-clock text-[var(--icy-text-muted)]">
              {Math.round(preferences.displaySizeScale * 100)}%
            </span>
          </div>

          <div className="flex items-center min-h-[44px]">
            <input
              id="ic-launcher-display-size-slider"
              type="range"
              min="0.9"
              max="1.15"
              step="0.05"
              value={preferences.displaySizeScale}
              onChange={handleDisplaySizeChange}
              aria-label="Launcher UI display scale and spacing"
              className="icy-slider w-full"
            />
          </div>
          <p className="mt-2 text-xs text-[var(--icy-text-muted)]">
            Adjusts launcher interface scale and spacing without altering physical device resolution.
          </p>
        </section>

        {/* SECTION 4: LAUNCHER SECURITY */}
        <section
          aria-labelledby="settings-security-heading"
          className="py-6 border-b border-[var(--icy-border-subtle)]"
        >
          <h2
            id="settings-security-heading"
            className="text-sm font-medium tracking-wider text-[var(--icy-text-secondary)] mb-4"
          >
            Launcher security
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-base text-[var(--icy-text-primary)]">
                Require a password to unlock the launcher.
              </span>
              <span className="text-xs text-[var(--icy-text-muted)] mt-1">
                Protects access to the IC App Launcher interface. Does not encrypt host OS files or replace device lock security.
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={hasConfiguredPassword}
              aria-label="Require a password to unlock the launcher"
              onClick={handleTogglePasswordSwitch}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--icy-border-focus)] ${
                hasConfiguredPassword
                  ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                  : 'bg-transparent border-[var(--icy-text-muted)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                  hasConfiguredPassword
                    ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                    : 'translate-x-1 bg-[var(--icy-text-muted)]'
                }`}
              />
            </button>
          </div>

          {securityFeedback ? (
            <div
              role="status"
              className="mt-4 px-4 py-2.5 rounded-xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] text-sm text-[var(--icy-text-primary)]"
            >
              {securityFeedback}
            </div>
          ) : null}

          {hasConfiguredPassword && securityMode === 'idle' ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onLockLauncherImmediately}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>Lock launcher now</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetSecurityForm();
                  setSecurityFeedback(null);
                  setSecurityMode('change');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--icy-bg-surface)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-text-primary)] border border-[var(--icy-border-subtle)] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Change password
              </button>

              <button
                type="button"
                onClick={() => {
                  resetSecurityForm();
                  setSecurityFeedback(null);
                  setSecurityMode('disable');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl text-[var(--icy-danger-text)] hover:bg-[var(--icy-danger-bg)] border border-transparent hover:border-[var(--icy-danger-border)] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Disable password
              </button>
            </div>
          ) : null}

          {securityMode !== 'idle' ? (
            <form
              onSubmit={handleSecurityFormSubmit}
              noValidate
              className="mt-5 p-4 sm:p-5 rounded-2xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-[var(--icy-text-primary)]">
                  {securityMode === 'create' && 'Create launcher password'}
                  {securityMode === 'change' && 'Change launcher password'}
                  {securityMode === 'disable' && 'Verify password to disable protection'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPasswords((prev) => !prev)}
                  aria-label={showPasswords ? 'Hide password fields' : 'Show password fields'}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {showPasswords ? (
                    <>
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" aria-hidden="true" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>

              {(securityMode === 'change' || securityMode === 'disable') ? (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="security-current-password"
                    className="text-xs font-medium text-[var(--icy-text-secondary)]"
                  >
                    Current password
                  </label>
                  <input
                    id="security-current-password"
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] text-sm focus:outline-none focus:border-[var(--icy-border-focus)]"
                  />
                </div>
              ) : null}

              {(securityMode === 'create' || securityMode === 'change') ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="security-new-password"
                      className="text-xs font-medium text-[var(--icy-text-secondary)]"
                    >
                      New password
                    </label>
                    <input
                      id="security-new-password"
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 4 characters"
                      autoComplete="new-password"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] text-sm focus:outline-none focus:border-[var(--icy-border-focus)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="security-confirm-password"
                      className="text-xs font-medium text-[var(--icy-text-secondary)]"
                    >
                      Confirm new password
                    </label>
                    <input
                      id="security-confirm-password"
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] text-sm focus:outline-none focus:border-[var(--icy-border-focus)]"
                    />
                  </div>
                </>
              ) : null}

              {securityError ? (
                <div
                  role="alert"
                  className="px-3.5 py-2 rounded-xl border border-[var(--icy-danger-border)] bg-[var(--icy-danger-bg)] text-[var(--icy-danger-text)] text-xs"
                >
                  {securityError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    resetSecurityForm();
                    setSecurityMode('idle');
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSecurity}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[var(--icy-accent-primary)] text-[var(--icy-accent-text)] text-sm font-medium hover:opacity-95 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {securityMode === 'create' && 'Save password'}
                  {securityMode === 'change' && 'Update password'}
                  {securityMode === 'disable' && 'Disable protection'}
                </button>
              </div>
            </form>
          ) : null}

          <p className="mt-4 text-xs text-[var(--icy-text-muted)] leading-relaxed">
            Recovery limitation: Passwords are stored locally as a salted PBKDF2-SHA256 verifier and are never saved in plain text or sent to a server. If a password is forgotten, it cannot be recovered without clearing the application&apos;s local data.
          </p>
        </section>

        {/* SECTION 5: LOCAL PROFILE & CLOCK FORMAT */}
        <section
          aria-labelledby="settings-profile-heading"
          className="py-6 border-b border-[var(--icy-border-subtle)]"
        >
          <h2
            id="settings-profile-heading"
            className="text-sm font-medium tracking-wider text-[var(--icy-text-secondary)] mb-4"
          >
            Profile &amp; Clock
          </h2>

          {/* Local Profile Display Name */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label
              htmlFor="ic-launcher-local-display-name"
              className="flex flex-col text-base text-[var(--icy-text-primary)]"
            >
              <span>Local profile</span>
              <span className="text-sm text-[var(--icy-text-secondary)]">
                Display-name
              </span>
            </label>

            <input
              id="ic-launcher-local-display-name"
              type="text"
              value={preferences.localProfile.displayName}
              onChange={handleDisplayNameChange}
              placeholder="Local display name"
              maxLength={64}
              autoComplete="name"
              className="w-full sm:w-64 min-h-[44px] px-3.5 py-2 rounded-lg bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] placeholder:text-[var(--icy-text-muted)] text-base focus:outline-none focus:border-[var(--icy-border-focus)]"
            />
          </div>

          <div className="mt-5 pt-5 border-t border-[var(--icy-border-subtle)]/60 flex items-center justify-between gap-4">
            <span className="text-sm text-[var(--icy-text-primary)]">
              Clock format
            </span>
            <div
              role="group"
              aria-label="Clock time format"
              className="inline-flex rounded-lg p-1 bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)]"
            >
              <button
                type="button"
                onClick={() => handleTimeFormatChange('12h')}
                aria-pressed={preferences.timeFormat === '12h'}
                className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  preferences.timeFormat === '12h'
                    ? 'bg-[var(--icy-button-bg)] text-[var(--icy-button-text)] shadow-2xs'
                    : 'text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)]'
                }`}
              >
                12-hour
              </button>
              <button
                type="button"
                onClick={() => handleTimeFormatChange('24h')}
                aria-pressed={preferences.timeFormat === '24h'}
                className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  preferences.timeFormat === '24h'
                    ? 'bg-[var(--icy-button-bg)] text-[var(--icy-button-text)] shadow-2xs'
                    : 'text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)]'
                }`}
              >
                24-hour
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 6: ICY AI */}
        <section
          aria-labelledby="settings-icy-ai-heading"
          className="py-6 border-b border-[var(--icy-border-subtle)] flex flex-col gap-5"
        >
          <h2
            id="settings-icy-ai-heading"
            className="text-sm font-medium tracking-wider text-[var(--icy-text-secondary)]"
          >
            ICY AI
          </h2>

          {/* Enable / Disable Assistant */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-base text-[var(--icy-text-primary)]">
                Enable {aiConfig.assistantName}
              </span>
              <span className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                Allow your personalized assistant to operate in compatible ICY interfaces.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={aiConfig.enabled}
              aria-label="Enable ICY AI assistant"
              onClick={() =>
                onUpdateAIConfig((prev) => ({
                  ...prev,
                  enabled: !prev.enabled,
                }))
              }
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--icy-border-focus)] ${
                aiConfig.enabled
                  ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                  : 'bg-transparent border-[var(--icy-text-muted)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-150 my-auto ${
                  aiConfig.enabled
                    ? 'translate-x-7 bg-[var(--icy-accent-text)]'
                    : 'translate-x-1 bg-[var(--icy-text-muted)]'
                }`}
              />
            </button>
          </div>

          {/* Assistant Name */}
          <form onSubmit={handleSaveAssistantName} className="flex flex-col gap-2">
            <label
              htmlFor="settings-ai-assistant-name"
              className="text-sm text-[var(--icy-text-primary)]"
            >
              Name your ICY AI
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="settings-ai-assistant-name"
                type="text"
                value={assistantNameDraft}
                onChange={(e) => {
                  setAssistantNameDraft(e.target.value);
                  if (assistantNameError) setAssistantNameError(null);
                  if (assistantNameFeedback) setAssistantNameFeedback(null);
                }}
                placeholder="Enter your assistant's name"
                maxLength={40}
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] text-sm focus:outline-none focus:border-[var(--icy-border-focus)]"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap shrink-0"
              >
                Save name
              </button>
            </div>
            {assistantNameError ? (
              <span role="alert" className="text-xs text-[var(--icy-danger-text)]">
                {assistantNameError}
              </span>
            ) : null}
            {assistantNameFeedback ? (
              <span role="status" className="text-xs text-[var(--icy-text-secondary)]">
                {assistantNameFeedback}
              </span>
            ) : null}
          </form>

          {/* Application Access Scope */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--icy-border-subtle)]/60">
            <span className="text-sm font-medium text-[var(--icy-text-primary)]">
              Application access scope
            </span>
            <div
              role="radiogroup"
              aria-label="Application access scope"
              className="flex flex-col gap-2"
            >
              {SCOPE_CHOICES.map((choice) => {
                const selected = aiConfig.applicationScope === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      onUpdateAIConfig((prev) => ({
                        ...prev,
                        applicationScope: choice.id,
                      }))
                    }
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                      selected
                        ? 'bg-[var(--icy-bg-surface)] border-[var(--icy-border-focus)]'
                        : 'bg-transparent border-[var(--icy-border-subtle)] hover:bg-[var(--icy-bg-surface)]/50'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[var(--icy-text-primary)]">
                        {choice.title}
                      </span>
                      <span className="text-xs text-[var(--icy-text-secondary)] leading-relaxed">
                        {choice.description}
                      </span>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        selected
                          ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)] text-[var(--icy-accent-text)]'
                          : 'border-[var(--icy-border-subtle)]'
                      }`}
                    >
                      {selected ? (
                        <Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capability Permissions */}
          <div className="flex flex-col gap-3 pt-2 border-t border-[var(--icy-border-subtle)]/60">
            <span className="text-sm font-medium text-[var(--icy-text-primary)]">
              Capability permissions
            </span>

            {/* Chat & Assistance */}
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-sm text-[var(--icy-text-primary)]">
                  Chat and assistance
                </span>
                <span className="text-xs text-[var(--icy-text-muted)]">
                  General questions and assistance without private app access.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiPermissions.chatAndAssistance}
                aria-label="Chat and assistance capability permission"
                onClick={() =>
                  onUpdateAIPermissions((prev) => ({
                    ...prev,
                    chatAndAssistance: !prev.chatAndAssistance,
                  }))
                }
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${
                  aiPermissions.chatAndAssistance
                    ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                    : 'bg-transparent border-[var(--icy-text-muted)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition-transform my-auto ${
                    aiPermissions.chatAndAssistance
                      ? 'translate-x-6 bg-[var(--icy-accent-text)]'
                      : 'translate-x-1 bg-[var(--icy-text-muted)]'
                  }`}
                />
              </button>
            </div>

            {/* Application Context Access */}
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-sm text-[var(--icy-text-primary)]">
                  Application context access
                </span>
                <span className="text-xs text-[var(--icy-text-muted)]">
                  Read selected context from compatible integrated applications.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiPermissions.applicationContextAccess}
                aria-label="Application context access capability permission"
                onClick={() =>
                  onUpdateAIPermissions((prev) => ({
                    ...prev,
                    applicationContextAccess: !prev.applicationContextAccess,
                  }))
                }
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${
                  aiPermissions.applicationContextAccess
                    ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                    : 'bg-transparent border-[var(--icy-text-muted)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition-transform my-auto ${
                    aiPermissions.applicationContextAccess
                      ? 'translate-x-6 bg-[var(--icy-accent-text)]'
                      : 'translate-x-1 bg-[var(--icy-text-muted)]'
                  }`}
                />
              </button>
            </div>

            {/* Application Actions */}
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-sm text-[var(--icy-text-primary)]">
                  Application actions
                </span>
                <span className="text-xs text-[var(--icy-text-muted)]">
                  Perform registered actions in compatible apps (confirmation required for sensitive actions).
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiPermissions.applicationActions}
                aria-label="Application actions capability permission"
                onClick={() =>
                  onUpdateAIPermissions((prev) => ({
                    ...prev,
                    applicationActions: !prev.applicationActions,
                  }))
                }
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${
                  aiPermissions.applicationActions
                    ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                    : 'bg-transparent border-[var(--icy-text-muted)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition-transform my-auto ${
                    aiPermissions.applicationActions
                      ? 'translate-x-6 bg-[var(--icy-accent-text)]'
                      : 'translate-x-1 bg-[var(--icy-text-muted)]'
                  }`}
                />
              </button>
            </div>

            {/* Optional Lock-Screen AI Chat */}
            <div className="flex items-center justify-between gap-4 py-1 pt-3 border-t border-[var(--icy-border-subtle)]/60">
              <div className="flex flex-col">
                <span className="text-sm text-[var(--icy-text-primary)]">
                  Lock-screen AI chat
                </span>
                <span className="text-xs text-[var(--icy-text-muted)]">
                  Separate optional setting allowing restricted pre-unlock questions without exposing private account or app data.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiConfig.lockScreenChatEnabled}
                aria-label="Lock-screen AI chat setting"
                onClick={() =>
                  onUpdateAIConfig((prev) => ({
                    ...prev,
                    lockScreenChatEnabled: !prev.lockScreenChatEnabled,
                  }))
                }
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${
                  aiConfig.lockScreenChatEnabled
                    ? 'bg-[var(--icy-accent-primary)] border-[var(--icy-accent-primary)]'
                    : 'bg-transparent border-[var(--icy-text-muted)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition-transform my-auto ${
                    aiConfig.lockScreenChatEnabled
                      ? 'translate-x-6 bg-[var(--icy-accent-text)]'
                      : 'translate-x-1 bg-[var(--icy-text-muted)]'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 7: HELP */}
        <section
          aria-labelledby="settings-help-heading"
          className="py-6 border-b border-[var(--icy-border-subtle)]"
        >
          <h2
            id="settings-help-heading"
            className="text-sm font-medium tracking-wider text-[var(--icy-text-secondary)] mb-4"
          >
            Help &amp; Guidance
          </h2>
          <button
            type="button"
            onClick={onOpenHelp}
            className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-[var(--icy-bg-surface)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-text-primary)] border border-[var(--icy-border-subtle)] text-sm font-medium transition-colors cursor-pointer flex items-center justify-between"
          >
            <span className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-[var(--icy-text-secondary)]" />
              View help topics
            </span>
          </button>
        </section>

        {/* SECTION 7: ICY ACCOUNT CONNECTION & SERVICE BUS */}
        <section
          aria-labelledby="settings-icy-service-heading"
          className="py-6 border-b border-[var(--icy-border-subtle)] flex flex-col gap-5"
        >
          {/* Header & Connection Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2
                id="settings-icy-service-heading"
                className="text-sm font-medium tracking-wider text-[var(--icy-text-secondary)]"
              >
                ICY Account & Service Connection
              </h2>
              <p className="text-xs text-[var(--icy-text-muted)] mt-0.5">
                Manage account authentication, service credentials, and authoritative application registry access.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  (accountSession?.status === 'connected' || serviceStatus.status === 'connected')
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : (accountSession?.status === 'authenticated' || serviceStatus.status === 'authenticated')
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    : accountSession?.status === 'awaiting-authorization'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : accountSession?.status === 'session-expired'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-[var(--icy-bg-surface)] text-[var(--icy-text-secondary)] border-[var(--icy-border-subtle)]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    (accountSession?.status === 'connected' || serviceStatus.status === 'connected')
                      ? 'bg-emerald-400'
                      : (accountSession?.status === 'authenticated' || serviceStatus.status === 'authenticated')
                      ? 'bg-blue-400'
                      : accountSession?.status === 'awaiting-authorization'
                      ? 'bg-amber-400'
                      : accountSession?.status === 'session-expired'
                      ? 'bg-rose-400'
                      : 'bg-zinc-400'
                  }`}
                />
                {isTestingService
                  ? 'Connecting...'
                  : isAuthorizingAccount
                  ? 'Authorizing...'
                  : formatConnectionStatusLabel(
                      accountSession?.status || serviceStatus.status
                    )}
              </span>
            </div>
          </div>

          {/* Diagnostic status or error detail */}
          {(accountSession?.errorDetail || serviceStatus.errorDetail) ? (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] text-xs text-[var(--icy-text-secondary)] leading-relaxed"
            >
              {accountSession?.errorDetail || serviceStatus.errorDetail}
            </div>
          ) : null}

          {accountActionFeedback ? (
            <div
              role="status"
              className="p-3 rounded-xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] text-xs text-[var(--icy-text-primary)]"
            >
              {accountActionFeedback}
            </div>
          ) : null}

          {serviceActionFeedback ? (
            <div
              role="status"
              className="p-3 rounded-xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] text-xs text-[var(--icy-text-primary)]"
            >
              {serviceActionFeedback}
            </div>
          ) : null}

          {/* 1. ICY Account Authentication Card (Authorization Code Flow with PKCE) */}
          <div className="p-4 rounded-xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--icy-accent-primary)]/10 border border-[var(--icy-accent-primary)]/20 flex items-center justify-center text-[var(--icy-accent-primary)] shrink-0">
                  <User className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--icy-text-primary)]">
                    ICY Account Identity
                  </h3>
                  <p className="text-xs text-[var(--icy-text-muted)]">
                    User authentication via authorization-code flow with PKCE handoff.
                  </p>
                </div>
              </div>
              {accountSession?.isAuthenticated ? (
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Linked
                </span>
              ) : null}
            </div>

            {accountSession?.isAuthenticated && accountSession.user ? (
              <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--icy-border-subtle)]/60 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--icy-text-secondary)]">Authenticated User:</span>
                  <span className="font-medium text-[var(--icy-text-primary)]">
                    {accountSession.user.displayName} (@{accountSession.user.username})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--icy-text-secondary)]">Email Address:</span>
                  <span className="text-[var(--icy-text-primary)] font-mono text-[11px]">
                    {accountSession.user.email}
                  </span>
                </div>
                {accountSession.sessionExpiresAt ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--icy-text-secondary)]">Session Expires:</span>
                    <span className="text-[var(--icy-text-muted)]">
                      {new Date(accountSession.sessionExpiresAt).toLocaleTimeString()}
                    </span>
                  </div>
                ) : null}
                {accountSession.grantedScopes.length > 0 ? (
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-[var(--icy-text-secondary)]">Granted Account Scopes:</span>
                    <div className="flex flex-wrap gap-1">
                      {accountSession.grantedScopes.map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-0.5 rounded bg-[var(--icy-bg-input)] text-[var(--icy-text-secondary)] text-[10px] font-mono border border-[var(--icy-border-subtle)]"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isTestingService}
                    onClick={async () => {
                      setAccountActionFeedback(null);
                      setIsTestingService(true);
                      try {
                        if (onVerifyAccountSession) {
                          const res = await onVerifyAccountSession();
                          setAccountActionFeedback(
                            res.status === 'connected'
                              ? 'Verified active authenticated session with ICY Account service.'
                              : res.errorDetail || 'Completed verification check.'
                          );
                        }
                      } finally {
                        setIsTestingService(false);
                      }
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isTestingService ? 'Verifying...' : 'Test Connection'}
                  </button>

                  <button
                    type="button"
                    disabled={isTestingService}
                    onClick={async () => {
                      setAccountActionFeedback(null);
                      setIsTestingService(true);
                      try {
                        if (onSignOutAccount) {
                          await onSignOutAccount();
                          setAccountActionFeedback('Signed out of ICY Account.');
                        }
                      } finally {
                        setIsTestingService(false);
                      }
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-[var(--icy-danger-text)] hover:bg-[var(--icy-danger-bg)] text-xs font-medium cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 pt-1">
                <p className="text-xs text-[var(--icy-text-secondary)] leading-relaxed">
                  Sign in with ICY Account to link your user identity, reuse authenticated sessions across launches, and enable delegated authorization for compatible apps.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isAuthorizingAccount}
                    onClick={async () => {
                      if (!onStartAccountAuth) return;
                      setAccountActionFeedback(null);
                      setIsAuthorizingAccount(true);
                      try {
                        const result = await onStartAccountAuth();
                        if (result.success && result.authUrl) {
                          setAccountActionFeedback('Redirecting to ICY Account authorization flow...');
                          // Open in window or redirect
                          window.location.href = result.authUrl;
                        } else {
                          setAccountActionFeedback(result.error || 'Failed to start authorization.');
                        }
                      } finally {
                        setIsAuthorizingAccount(false);
                      }
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--icy-accent-primary)] text-[var(--icy-accent-text)] text-xs sm:text-sm font-medium hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    {isAuthorizingAccount ? 'Starting Auth...' : 'Connect with ICY Account'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Privileged ICY Account Core Service Key Card */}
          <div className="p-4 rounded-xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] flex items-center justify-center text-[var(--icy-text-secondary)] shrink-0">
                <Key className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--icy-text-primary)]">
                  Privileged ICY Core Service Key
                </h3>
                <p className="text-xs text-[var(--icy-text-muted)]">
                  Server-to-service credential kept strictly on the trusted backend.
                </p>
              </div>
            </div>

            {serviceStatus.hasKeyConfigured && serviceStatus.keyHint ? (
              <div className="text-xs text-[var(--icy-text-muted)] flex items-center justify-between">
                <span>Configured server key: {serviceStatus.keyHint}</span>
                {serviceStatus.lastVerifiedAt ? (
                  <span>Verified: {new Date(serviceStatus.lastVerifiedAt).toLocaleTimeString()}</span>
                ) : null}
              </div>
            ) : null}

            {/* API Key Input ONLY (No URL field, as instructed) */}
            <form onSubmit={handleSaveAndTestApiKey} className="flex flex-col gap-3 pt-1">
              <label
                htmlFor="icy-platform-api-key-input"
                className="text-xs font-medium text-[var(--icy-text-secondary)]"
              >
                ICY Private API Key
              </label>
              <div className="relative flex items-center">
                <input
                  id="icy-platform-api-key-input"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    serviceStatus.hasKeyConfigured
                      ? 'Enter a new key to replace configured credential'
                      : 'Enter ICY Private Platform API Key'
                  }
                  autoComplete="off"
                  className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-[var(--icy-text-primary)] text-sm focus:outline-none focus:border-[var(--icy-border-focus)]"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[var(--icy-text-muted)] hover:text-[var(--icy-text-primary)] cursor-pointer"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isTestingService || !apiKeyInput.trim()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--icy-accent-primary)] text-[var(--icy-accent-text)] text-xs sm:text-sm font-medium hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {isTestingService && apiKeyInput.trim()
                    ? 'Connecting...'
                    : serviceStatus.hasKeyConfigured
                    ? 'Replace key & connect'
                    : 'Connect'}
                </button>

                {serviceStatus.hasKeyConfigured ? (
                  <button
                    type="button"
                    disabled={isTestingService}
                    onClick={async () => {
                      setServiceActionFeedback(null);
                      setIsTestingService(true);
                      try {
                        await onVerifyPlatformConnection();
                      } finally {
                        setIsTestingService(false);
                      }
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] border border-[var(--icy-border-subtle)] text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {isTestingService ? 'Testing...' : 'Test Connection'}
                  </button>
                ) : null}

                {serviceStatus.hasKeyConfigured ? (
                  <button
                    type="button"
                    disabled={isTestingService}
                    onClick={() => void handleDisconnectApiKey()}
                    className="min-h-[40px] px-4 py-2 rounded-xl text-[var(--icy-danger-text)] hover:bg-[var(--icy-danger-bg)] text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    Disconnect credential
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          {/* 3. Authoritative Official ICY App Registry & Service Bus */}
          <div className="p-4 rounded-xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] flex items-center justify-center text-[var(--icy-text-secondary)] shrink-0">
                  <Layers className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-[var(--icy-text-primary)]">
                      Authoritative ICY App Registry & Service Bus
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--icy-accent-primary)]/10 text-[var(--icy-accent-primary)] text-[11px] font-medium border border-[var(--icy-accent-primary)]/20">
                      {officialApps.length} Apps
                    </span>
                  </div>
                  <p className="text-xs text-[var(--icy-text-muted)]">
                    Per-service least privilege: each app receives only its scoped delegation context.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowOfficialAppsPanel((prev) => !prev)}
                className="p-2 rounded-lg text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] hover:bg-[var(--icy-button-hover-bg)] cursor-pointer"
                aria-label={showOfficialAppsPanel ? 'Collapse official apps' : 'Expand official apps'}
              >
                {showOfficialAppsPanel ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {showOfficialAppsPanel ? (
              <div className="flex flex-col gap-3 pt-2 border-t border-[var(--icy-border-subtle)]/60">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-3 text-[var(--icy-text-muted)]" aria-hidden="true" />
                  <input
                    type="text"
                    value={officialAppsQuery}
                    onChange={(e) => setOfficialAppsQuery(e.target.value)}
                    placeholder="Search registered official applications or permissions..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] text-xs text-[var(--icy-text-primary)] focus:outline-none focus:border-[var(--icy-border-focus)]"
                  />
                </div>

                {delegatedTokenPreview ? (
                  <div className="p-3 rounded-lg bg-[var(--icy-bg-input)] border border-[var(--icy-border-focus)]/40 flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--icy-text-primary)]">
                        Scoped Delegation Token: {delegatedTokenPreview.appId}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDelegatedTokenPreview(null)}
                        className="text-[var(--icy-text-muted)] hover:text-[var(--icy-text-primary)] text-[11px]"
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--icy-text-secondary)]">
                      {delegatedTokenPreview.tokenSummary}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {delegatedTokenPreview.permissions.map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-[var(--icy-bg-surface)] text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="max-h-72 overflow-y-auto flex flex-col gap-2 pr-1">
                  {officialApps
                    .filter((app) => {
                      if (!officialAppsQuery.trim()) return true;
                      const q = officialAppsQuery.toLowerCase();
                      return (
                        app.name.toLowerCase().includes(q) ||
                        app.id.toLowerCase().includes(q) ||
                        app.permissions.some((p) => p.toLowerCase().includes(q))
                      );
                    })
                    .map((app) => (
                      <div
                        key={app.id}
                        className="p-2.5 rounded-lg bg-[var(--icy-bg-input)] border border-[var(--icy-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[var(--icy-text-primary)]">
                              {app.name}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--icy-text-muted)]">
                              {app.id}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--icy-text-muted)]">
                            <span className="px-1.5 py-0.2 rounded bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)]">
                              Status: {app.implementationStatus || 'implemented'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)]">
                              Compat: {app.compatibilityStatus || 'compatible'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)]">
                              Runtime: {app.runtimeType || 'web-app'}
                            </span>
                          </div>
                          {app.permissions.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {app.permissions.map((perm) => (
                                <span
                                  key={perm}
                                  className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--icy-bg-surface)] text-[var(--icy-text-secondary)]"
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--icy-text-muted)] italic">
                              Zero privileged permissions required
                            </span>
                          )}
                        </div>

                        {onRequestDelegatedToken ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const token = (await onRequestDelegatedToken(app.id)) as {
                                delegatedToken?: string;
                                permissions?: string[];
                              } | null;
                              if (token && token.delegatedToken) {
                                setDelegatedTokenPreview({
                                  appId: app.id,
                                  tokenSummary: `Delegated token issued (Scoped: ${token.delegatedToken.slice(0, 16)}...). Master credentials are never shared.`,
                                  permissions: token.permissions || app.permissions,
                                });
                              }
                            }}
                            className="px-2 py-1 rounded bg-[var(--icy-button-bg)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-button-text)] text-[10px] font-medium border border-[var(--icy-border-subtle)] cursor-pointer shrink-0 self-start sm:self-auto"
                          >
                            Acquire Scoped Token
                          </button>
                        ) : null}
                      </div>
                    ))}

                  {officialApps.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--icy-text-muted)]">
                      No official ICY applications are currently registered in this launcher.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* SECTION 8: INSTALLED APPLICATIONS */}
        <section
          aria-labelledby="settings-installed-apps-heading"
          className="py-8 flex flex-col gap-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="settings-installed-apps-heading"
                className="text-sm font-bold tracking-widest text-[var(--icy-text-secondary)] uppercase"
              >
                Installed Applications
              </h2>
              <p className="text-xs text-[var(--icy-text-muted)] mt-1">
                Manage all applications currently integrated with your ICOS environment.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[var(--icy-accent-primary)]/10 text-[var(--icy-accent-primary)] text-xs font-bold border border-[var(--icy-accent-primary)]/20">
              {installedApps.length} Apps
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {installedApps.map((app) => (
              <div
                key={app.id}
                className="group p-4 rounded-2xl bg-[var(--icy-bg-surface)] border border-[var(--icy-border-subtle)] hover:border-[var(--icy-accent-primary)]/40 transition-all flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-lg font-bold text-[var(--icy-text-primary)] font-mono">{app.name[0]}</span>
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-bold text-[var(--icy-text-primary)] truncate">{app.name}</span>
                    <span className="text-[10px] text-[var(--icy-text-muted)] font-mono truncate">{app.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedInstalledApp(app)}
                    className="p-2.5 rounded-xl bg-[var(--icy-bg-input)] hover:bg-[var(--icy-button-hover-bg)] text-[var(--icy-text-secondary)] hover:text-[var(--icy-text-primary)] transition-colors cursor-pointer"
                    title="View App Info"
                  >
                    <Info className="w-4.5 h-4.5" />
                  </button>
                  <button
                    onClick={() => onUninstallApp?.(app.id)}
                    className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors cursor-pointer"
                    title="Uninstall App"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))}

            {installedApps.length === 0 && (
              <div className="py-12 text-center border-2 border-dashed border-[var(--icy-border-subtle)] rounded-3xl">
                <span className="text-sm text-[var(--icy-text-muted)]">No applications installed.</span>
              </div>
            )}
          </div>

          {/* App Info Overlay */}
          {selectedInstalledApp && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
              <div className="w-full max-w-lg bg-[#0e101c] border border-white/20 rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-8 border-b border-white/10 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-[24px] bg-gradient-to-tr from-[var(--icy-accent-primary)] to-[var(--icy-accent-primary)]/40 flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                      {selectedInstalledApp.name[0]}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-2xl font-bold text-white leading-tight">{selectedInstalledApp.name}</h3>
                      <p className="text-sm text-white/50">{selectedInstalledApp.publisher} · v{selectedInstalledApp.version}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedInstalledApp(null)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] no-scrollbar">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Description</span>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {selectedInstalledApp.description || 'No description available for this application.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <span className="text-[9px] font-bold text-white/30 uppercase">Package ID</span>
                      <p className="text-xs text-white/90 font-mono truncate">{selectedInstalledApp.id}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <span className="text-[9px] font-bold text-white/30 uppercase">Runtime</span>
                      <p className="text-xs text-white/90 font-mono capitalize">{selectedInstalledApp.runtimeType || 'web-app'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Permissions</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedInstalledApp.permissions.map((p) => (
                        <span key={p} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 font-mono">
                          {p}
                        </span>
                      ))}
                      {selectedInstalledApp.permissions.length === 0 && (
                        <span className="text-xs text-white/40 italic">Zero privileged permissions.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-8 pt-0 flex items-center gap-3">
                  <button
                    onClick={() => {
                      onUninstallApp?.(selectedInstalledApp.id);
                      setSelectedInstalledApp(null);
                    }}
                    className="flex-1 py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                    Uninstall Application
                  </button>
                  <button
                    onClick={() => setSelectedInstalledApp(null)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
