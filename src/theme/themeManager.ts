/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResolvedTheme, ThemeOption } from '../types/launcher';

export interface ThemePaletteDefinition {
  id: ThemeOption;
  label: string;
  swatchColor: string;
   swatchBorder?: string;
  description: string;
}

export const THEME_OPTIONS: ThemePaletteDefinition[] = [
  {
    id: 'light',
    label: 'Light',
    swatchColor: '#F4F3EE',
    swatchBorder: '#4A4842',
    description: 'Warm neutral daylight surface',
  },
  {
    id: 'dark',
    label: 'Dark',
    swatchColor: '#2B2B2B',
    description: 'Calm low-glare charcoal surface',
  },
  {
    id: 'blue',
    label: 'Blue',
    swatchColor: '#1E70C1',
    description: 'Crisp ocean blue theme',
  },
  {
    id: 'green',
    label: 'Green',
    swatchColor: '#3B8E4E',
    description: 'Balanced botanical green theme',
  },
  {
    id: 'purple',
    label: 'Purple',
    swatchColor: '#8B32A8',
    description: 'Soft plum & violet theme',
  },
  {
    id: 'slate',
    label: 'Slate',
    swatchColor: '#475569',
    description: 'Cool mineral slate theme',
  },
  {
    id: 'amber',
    label: 'Amber',
    swatchColor: '#B45309',
    description: 'Warm sand & amber theme',
  },
  {
    id: 'rose',
    label: 'Rose',
    swatchColor: '#BE123C',
    description: 'Subtle dusty rose theme',
  },
  {
    id: 'system',
    label: 'System',
    swatchColor: 'linear-gradient(135deg, #F4F3EE 50%, #1C1D21 50%)',
    swatchBorder: '#78756E',
    description: 'Follows device light or dark preference',
  },
];

export interface ThemeTokens {
  bgCanvas: string;
  bgSurface: string;
  bgInput: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  borderFocus: string;
  accentPrimary: string;
  accentText: string;
  buttonBg: string;
  buttonText: string;
  buttonHoverBg: string;
  dangerText: string;
  dangerBg: string;
  dangerBorder: string;
}

export const THEME_TOKEN_MAP: Record<ResolvedTheme, ThemeTokens> = {
  light: {
    bgCanvas: '#F3F2EC',
    bgSurface: '#FAF9F5',
    bgInput: '#F7F6F1',
    bgElevated: '#FFFFFF',
    textPrimary: '#1A1917',
    textSecondary: '#4A4843',
    textMuted: '#6E6B64',
    borderSubtle: '#D6D3CA',
    borderFocus: '#4A4842',
    accentPrimary: '#4A4842',
    accentText: '#FFFFFF',
    buttonBg: '#FFFFFF',
    buttonText: '#1A1917',
    buttonHoverBg: '#EAE8E0',
    dangerText: '#B91C1C',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },
  dark: {
    bgCanvas: '#16171A',
    bgSurface: '#202227',
    bgInput: '#1C1E22',
    bgElevated: '#282B30',
    textPrimary: '#F3F4F6',
    textSecondary: '#C4C7CE',
    textMuted: '#8E929C',
    borderSubtle: '#343840',
    borderFocus: '#A1A6B4',
    accentPrimary: '#E5E7EB',
    accentText: '#16171A',
    buttonBg: '#282B30',
    buttonText: '#F3F4F6',
    buttonHoverBg: '#32363D',
    dangerText: '#F87171',
    dangerBg: '#2D1A1C',
    dangerBorder: '#5C2629',
  },
  blue: {
    bgCanvas: '#EDF3F9',
    bgSurface: '#F5F9FD',
    bgInput: '#F2F7FC',
    bgElevated: '#FFFFFF',
    textPrimary: '#0F2537',
    textSecondary: '#2C4A63',
    textMuted: '#52718A',
    borderSubtle: '#C5D8EA',
    borderFocus: '#1E70C1',
    accentPrimary: '#1E70C1',
    accentText: '#FFFFFF',
    buttonBg: '#FFFFFF',
    buttonText: '#0F2537',
    buttonHoverBg: '#E1ECF7',
    dangerText: '#B91C1C',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },
  green: {
    bgCanvas: '#EEF5F0',
    bgSurface: '#F6FAF7',
    bgInput: '#F3F8F4',
    bgElevated: '#FFFFFF',
    textPrimary: '#132A1A',
    textSecondary: '#2E4F38',
    textMuted: '#53755D',
    borderSubtle: '#C4DCCB',
    borderFocus: '#3B8E4E',
    accentPrimary: '#3B8E4E',
    accentText: '#FFFFFF',
    buttonBg: '#FFFFFF',
    buttonText: '#132A1A',
    buttonHoverBg: '#E2EFE6',
    dangerText: '#B91C1C',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },
  purple: {
    bgCanvas: '#F4EFF7',
    bgSurface: '#FAF7FC',
    bgInput: '#F7F3FA',
    bgElevated: '#FFFFFF',
    textPrimary: '#24122D',
    textSecondary: '#4B3257',
    textMuted: '#725680',
    borderSubtle: '#D8C7E2',
    borderFocus: '#8B32A8',
    accentPrimary: '#8B32A8',
    accentText: '#FFFFFF',
    buttonBg: '#FFFFFF',
    buttonText: '#24122D',
    buttonHoverBg: '#EAE0F0',
    dangerText: '#B91C1C',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },
  slate: {
    bgCanvas: '#EFF2F5',
    bgSurface: '#F7F9FA',
    bgInput: '#F4F6F8',
    bgElevated: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#334155',
    textMuted: '#64748B',
    borderSubtle: '#CBD5E1',
    borderFocus: '#475569',
    accentPrimary: '#475569',
    accentText: '#FFFFFF',
    buttonBg: '#FFFFFF',
    buttonText: '#1E293B',
    buttonHoverBg: '#E2E8F0',
    dangerText: '#B91C1C',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },
  amber: {
    bgCanvas: '#F7F3EB',
    bgSurface: '#FCF9F4',
    bgInput: '#FAF6EE',
    bgElevated: '#FFFFFF',
    textPrimary: '#291D0E',
    textSecondary: '#543E24',
    textMuted: '#7C6242',
    borderSubtle: '#DFD2BD',
    borderFocus: '#B45309',
    accentPrimary: '#B45309',
    accentText: '#FFFFFF',
    buttonBg: '#FFFFFF',
    buttonText: '#291D0E',
    buttonHoverBg: '#EFE7D8',
    dangerText: '#B91C1C',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },
  rose: {
    bgCanvas: '#F8EFF1',
    bgSurface: '#FCF6F7',
    bgInput: '#FAF2F4',
    bgElevated: '#FFFFFF',
    textPrimary: '#2D1219',
    textSecondary: '#592B37',
    textMuted: '#82505D',
    borderSubtle: '#E2C7CE',
    borderFocus: '#BE123C',
    accentPrimary: '#BE123C',
    accentText: '#FFFFFF',
    buttonBg: '#FFFFFF',
    buttonText: '#2D1219',
    buttonHoverBg: '#F0E1E5',
    dangerText: '#B91C1C',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
  },
};

/**
 * Resolves 'system' theme to 'dark' or 'light' based on OS media query.
 */
export function resolveTheme(theme: ThemeOption): ResolvedTheme {
  if (theme === 'system') {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }
  return theme;
}

/**
 * Applies theme tokens and font/display scales to the document root element.
 */
export function applyThemeAndScalesToDocument(
  theme: ThemeOption,
  fontSizeScale: number,
  displaySizeScale: number,
  themeColor?: string
): ResolvedTheme {
  const resolved = resolveTheme(theme);
  const tokens = THEME_TOKEN_MAP[resolved];

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    if (themeColor) {
      root.style.setProperty('--icy-theme-custom-color', themeColor);
    } else {
      root.style.setProperty('--icy-theme-custom-color', tokens.accentPrimary);
    }
    root.style.setProperty('--icy-bg-canvas', tokens.bgCanvas);
    root.style.setProperty('--icy-bg-surface', tokens.bgSurface);
    root.style.setProperty('--icy-bg-input', tokens.bgInput);
    root.style.setProperty('--icy-bg-elevated', tokens.bgElevated);
    root.style.setProperty('--icy-text-primary', tokens.textPrimary);
    root.style.setProperty('--icy-text-secondary', tokens.textSecondary);
    root.style.setProperty('--icy-text-muted', tokens.textMuted);
    root.style.setProperty('--icy-border-subtle', tokens.borderSubtle);
    root.style.setProperty('--icy-border-focus', tokens.borderFocus);
    root.style.setProperty('--icy-accent-primary', tokens.accentPrimary);
    root.style.setProperty('--icy-accent-text', tokens.accentText);
    root.style.setProperty('--icy-button-bg', tokens.buttonBg);
    root.style.setProperty('--icy-button-text', tokens.buttonText);
    root.style.setProperty('--icy-button-hover-bg', tokens.buttonHoverBg);
    root.style.setProperty('--icy-danger-text', tokens.dangerText);
    root.style.setProperty('--icy-danger-bg', tokens.dangerBg);
    root.style.setProperty('--icy-danger-border', tokens.dangerBorder);

    root.style.setProperty('--icy-font-scale', String(fontSizeScale));
    root.style.setProperty('--icy-display-scale', String(displaySizeScale));
  }

  return resolved;
}
