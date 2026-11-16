/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WallpaperPreset {
  id: string;
  name: string;
  value: string;
  previewCss: string;
  type: 'gradient' | 'image';
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'cosmic-aurora',
    name: 'Cosmic Aurora',
    value: 'linear-gradient(135deg, #0b0f19 0%, #111827 35%, #1e1b4b 70%, #0284c7 100%)',
    previewCss: 'linear-gradient(135deg, #0b0f19 0%, #111827 35%, #1e1b4b 70%, #0284c7 100%)',
    type: 'gradient',
  },
  {
    id: 'midnight-nebula',
    name: 'Midnight Nebula',
    value: 'radial-gradient(circle at 80% 20%, #4c1d95 0%, #0f172a 50%, #020617 100%)',
    previewCss: 'radial-gradient(circle at 80% 20%, #4c1d95 0%, #0f172a 50%, #020617 100%)',
    type: 'gradient',
  },
  {
    id: 'cyber-sunset',
    name: 'Cyber Sunset',
    value: 'linear-gradient(135deg, #1e1b4b 0%, #581c87 40%, #9f1239 80%, #fb7185 100%)',
    previewCss: 'linear-gradient(135deg, #1e1b4b 0%, #581c87 40%, #9f1239 80%, #fb7185 100%)',
    type: 'gradient',
  },
  {
    id: 'emerald-abyss',
    name: 'Emerald Abyss',
    value: 'radial-gradient(circle at 20% 80%, #064e3b 0%, #022c22 60%, #020617 100%)',
    previewCss: 'radial-gradient(circle at 20% 80%, #064e3b 0%, #022c22 60%, #020617 100%)',
    type: 'gradient',
  },
  {
    id: 'obsidian-charcoal',
    name: 'Obsidian Slate',
    value: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)',
    previewCss: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)',
    type: 'gradient',
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    value: 'linear-gradient(135deg, #0f172a 0%, #0c4a6e 50%, #0284c7 100%)',
    previewCss: 'linear-gradient(135deg, #0f172a 0%, #0c4a6e 50%, #0284c7 100%)',
    type: 'gradient',
  },
  {
    id: 'mountain-valley',
    name: 'Alpine Vista',
    value: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2000&q=80',
    previewCss: 'url("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=60") center/cover no-repeat',
    type: 'image',
  },
  {
    id: 'starry-cosmos',
    name: 'Starry Cosmos',
    value: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2000&q=80',
    previewCss: 'url("https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=60") center/cover no-repeat',
    type: 'image',
  },
  {
    id: 'abstract-waves',
    name: 'Neon Waves',
    value: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=2000&q=80',
    previewCss: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=60") center/cover no-repeat',
    type: 'image',
  },
];

export const DEFAULT_WALLPAPER = WALLPAPER_PRESETS[0].value;
