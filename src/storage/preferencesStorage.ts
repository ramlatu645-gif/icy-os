/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LauncherPreferences,
  ThemeOption,
  TimeFormatOption,
} from '../types/launcher';

const PREFERENCES_STORAGE_KEY = 'ic_app_launcher_preferences_v1';
const CURRENT_PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES: LauncherPreferences = {
  version: CURRENT_PREFERENCES_VERSION,
  theme: 'light',
  fontSizeScale: 1.0,
  displaySizeScale: 1.0,
  timeFormat: '12h',
  wallpaper: 'linear-gradient(135deg, #0b0f19 0%, #111827 35%, #1e1b4b 70%, #0284c7 100%)',
  showTaskbar: true,
  showSidebar: true,
  aiOperatorEnabled: true,
  pinnedAppIds: [],
  themeColor: '#1e70c1',
  localProfile: {
    displayName: '',
  },
};

const VALID_THEMES: ThemeOption[] = [
  'system',
  'light',
  'dark',
  'blue',
  'green',
  'purple',
  'slate',
  'amber',
  'rose',
];

const VALID_TIME_FORMATS: TimeFormatOption[] = ['12h', '24h'];

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 1.0;
  return Math.min(max, Math.max(min, value));
}

/**
 * Sanitizes and validates an arbitrary object into a valid LauncherPreferences record.
 * Handles missing, corrupted, or outdated preferences gracefully.
 */
export function sanitizePreferences(raw: unknown): LauncherPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PREFERENCES, localProfile: { ...DEFAULT_PREFERENCES.localProfile } };
  }

  const candidate = raw as Record<string, unknown>;

  const theme: ThemeOption =
    typeof candidate.theme === 'string' && VALID_THEMES.includes(candidate.theme as ThemeOption)
      ? (candidate.theme as ThemeOption)
      : DEFAULT_PREFERENCES.theme;

  const fontSizeScale =
    typeof candidate.fontSizeScale === 'number'
      ? clamp(candidate.fontSizeScale, 0.85, 1.25)
      : DEFAULT_PREFERENCES.fontSizeScale;

  const displaySizeScale =
    typeof candidate.displaySizeScale === 'number'
      ? clamp(candidate.displaySizeScale, 0.9, 1.15)
      : DEFAULT_PREFERENCES.displaySizeScale;

  const timeFormat: TimeFormatOption =
    typeof candidate.timeFormat === 'string' &&
    VALID_TIME_FORMATS.includes(candidate.timeFormat as TimeFormatOption)
      ? (candidate.timeFormat as TimeFormatOption)
      : DEFAULT_PREFERENCES.timeFormat;

  const wallpaper = typeof candidate.wallpaper === 'string' && candidate.wallpaper.length > 0
    ? candidate.wallpaper
    : DEFAULT_PREFERENCES.wallpaper;

  const showTaskbar = typeof candidate.showTaskbar === 'boolean'
    ? candidate.showTaskbar
    : DEFAULT_PREFERENCES.showTaskbar;

  const showSidebar = typeof candidate.showSidebar === 'boolean'
    ? candidate.showSidebar
    : DEFAULT_PREFERENCES.showSidebar;

  const aiOperatorEnabled = typeof candidate.aiOperatorEnabled === 'boolean'
    ? candidate.aiOperatorEnabled
    : DEFAULT_PREFERENCES.aiOperatorEnabled;

  const pinnedAppIds = Array.isArray(candidate.pinnedAppIds)
    ? candidate.pinnedAppIds.filter((id): id is string => typeof id === 'string')
    : DEFAULT_PREFERENCES.pinnedAppIds;

  const themeColor = typeof candidate.themeColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(candidate.themeColor)
    ? candidate.themeColor
    : DEFAULT_PREFERENCES.themeColor;

  let displayName = DEFAULT_PREFERENCES.localProfile.displayName;
  if (candidate.localProfile && typeof candidate.localProfile === 'object') {
    const profileObj = candidate.localProfile as Record<string, unknown>;
    if (typeof profileObj.displayName === 'string') {
      displayName = profileObj.displayName.slice(0, 64);
    }
  }

  return {
    version: CURRENT_PREFERENCES_VERSION,
    theme,
    fontSizeScale,
    displaySizeScale,
    timeFormat,
    wallpaper,
    showTaskbar,
    showSidebar,
    aiOperatorEnabled,
    pinnedAppIds,
    themeColor,
    localProfile: {
      displayName,
    },
  };
}

/**
 * Loads saved launcher preferences from local storage, falling back safely
 * to defaults if missing or corrupted.
 */
export function loadPreferences(): LauncherPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES, localProfile: { ...DEFAULT_PREFERENCES.localProfile } };
    }
    const parsed: unknown = JSON.parse(raw);
    return sanitizePreferences(parsed);
  } catch {
    return { ...DEFAULT_PREFERENCES, localProfile: { ...DEFAULT_PREFERENCES.localProfile } };
  }
}

/**
 * Persists launcher preferences to local storage.
 */
export function savePreferences(preferences: LauncherPreferences): void {
  try {
    const sanitized = sanitizePreferences(preferences);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Gracefully handle quota exceeded or private browsing restrictions
  }
}
