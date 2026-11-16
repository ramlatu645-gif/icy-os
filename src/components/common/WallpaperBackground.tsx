/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface WallpaperBackgroundProps {
  wallpaper: string;
  className?: string;
  blur?: boolean;
  dim?: boolean;
  children?: React.ReactNode;
}

export interface NormalizedWallpaper {
  isGradient: boolean;
  isImage: boolean;
  cleanUrl: string;
  cssValue: string;
}

/**
 * Normalizes any user-entered wallpaper string into a clean image URL or CSS background property.
 * Automatically cleans up:
 * - url('...') or url("...") wrappers
 * - Single/double quotes or HTML <img> tags pasted from websites
 * - Google Images redirect URLs (extracting direct imgurl)
 * - Unsplash photo page links (e.g. unsplash.com/photos/xyz -> direct image URL)
 * - Protocol-relative or bare domain URLs
 */
export function normalizeWallpaperUrl(rawWallpaper: string): NormalizedWallpaper {
  let trimmed = (rawWallpaper || '').trim();

  if (!trimmed) {
    return {
      isGradient: true,
      isImage: false,
      cleanUrl: '',
      cssValue: 'linear-gradient(135deg, #0b0f19 0%, #111827 35%, #1e1b4b 70%, #0284c7 100%)',
    };
  }

  // 1. Strip url('...'), quotes, or HTML <img> tags
  trimmed = trimmed
    .replace(/^url\((['"]?)(.*?)\1\)$/i, '$2')
    .replace(/^['"]|['"]$/g, '')
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/i, '$1')
    .trim();

  // 2. Check for CSS Gradients
  if (trimmed.includes('gradient(')) {
    return {
      isGradient: true,
      isImage: false,
      cleanUrl: '',
      cssValue: trimmed,
    };
  }

  // 3. Handle Google Images redirect links (extract imgurl=...)
  if (trimmed.includes('google.com/imgres') || trimmed.includes('google.com/url')) {
    try {
      const urlObj = new URL(trimmed);
      const imgUrlParam = urlObj.searchParams.get('imgurl') || urlObj.searchParams.get('url');
      if (imgUrlParam) {
        trimmed = decodeURIComponent(imgUrlParam);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  // 4. Handle Unsplash photo page links (e.g., https://unsplash.com/photos/abc-12345678)
  if (trimmed.includes('unsplash.com/photos/')) {
    const match = trimmed.match(/unsplash\.com\/photos\/([^?#/]+)/i);
    if (match && match[1]) {
      const photoId = match[1].split('-').pop() || match[1];
      trimmed = `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=2560&q=80`;
    }
  }

  // 5. Handle protocol-relative or bare domain URLs
  let finalUrl = trimmed;
  if (finalUrl.startsWith('//')) {
    finalUrl = `https:${finalUrl}`;
  } else if (
    !finalUrl.startsWith('http://') &&
    !finalUrl.startsWith('https://') &&
    !finalUrl.startsWith('data:') &&
    !finalUrl.startsWith('blob:') &&
    !finalUrl.startsWith('/') &&
    !finalUrl.startsWith('./')
  ) {
    if (finalUrl.includes('.') || finalUrl.includes('/')) {
      finalUrl = `https://${finalUrl}`;
    }
  }

  const isImage =
    finalUrl.startsWith('http://') ||
    finalUrl.startsWith('https://') ||
    finalUrl.startsWith('data:') ||
    finalUrl.startsWith('blob:') ||
    finalUrl.startsWith('/') ||
    finalUrl.startsWith('./');

  return {
    isGradient: !isImage,
    isImage,
    cleanUrl: isImage ? finalUrl : '',
    cssValue: isImage ? `url("${finalUrl}")` : finalUrl,
  };
}

export const WallpaperBackground: React.FC<WallpaperBackgroundProps> = ({
  wallpaper,
  className = '',
  blur = false,
  dim = false,
  children,
}) => {
  const { isGradient, isImage, cleanUrl, cssValue } = normalizeWallpaperUrl(wallpaper);

  return (
    <div className={`relative w-full h-dvh min-h-dvh overflow-hidden select-none font-['Plus_Jakarta_Sans'] bg-slate-950 text-white ${className}`}>
      {/* 1. Base Fallback Gradient Layer (Always present behind image) */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900" />

      {/* 2. CSS Gradient Background Layer */}
      {isGradient && (
        <div
          className="absolute inset-0 z-0 transition-all duration-700 ease-out"
          style={{
            background: cssValue,
            filter: blur ? 'blur(20px) brightness(0.55)' : dim ? 'brightness(0.85)' : 'brightness(0.95)',
            transform: blur ? 'scale(1.08)' : 'scale(1)',
          }}
        />
      )}

      {/* 3. Direct Native Image Layer (uses DOM display hiding on error to prevent React re-render loops) */}
      {isImage && cleanUrl && (
        <div
          className="absolute inset-0 z-0 transition-all duration-700 ease-out overflow-hidden"
          style={{
            filter: blur ? 'blur(20px) brightness(0.55)' : dim ? 'brightness(0.85)' : 'brightness(0.95)',
            transform: blur ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          <img
            key={cleanUrl}
            src={cleanUrl}
            alt="Wallpaper"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* 4. Subtle Vignette Overlay */}
      <div className="absolute inset-0 z-0 bg-radial-vignette opacity-75 pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 w-full h-dvh min-h-dvh flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
};
