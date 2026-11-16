/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ICOS Device Form Factor & Multi-Device Adaptation Engine
 */

import { useState, useEffect, useCallback } from 'react';

export type DeviceFormFactor = 'auto' | 'android' | 'workstation' | 'tablet' | 'desktop';

export interface DeviceAdaptiveProfile {
  mode: DeviceFormFactor;
  effectiveType: 'android' | 'workstation' | 'tablet' | 'desktop';
  displayName: string;
  isTouchOptimized: boolean;
  cornerRadiusClass: string;
  taskbarType: 'gesture-pill' | 'windows-center' | 'tablet-dock' | 'desktop-dock';
  gridColsClass: string;
  showMobileStatusBar: boolean;
  showAndroidGesturePill: boolean;
  windowingBehavior: 'windowed' | 'full-sheet';
}

const STORAGE_KEY = 'icyos_device_form_factor_v1';

export function detectNativeDeviceType(): 'android' | 'workstation' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';

  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  // Android detection
  if (ua.includes('android')) {
    if (minDim >= 600) return 'tablet';
    return 'android';
  }

  // iOS detection
  if (ua.includes('iphone') || ua.includes('ipod')) {
    return 'android'; // Map mobile form factor
  }
  if (ua.includes('ipad') || (ua.includes('macintosh') && isTouch)) {
    return 'tablet';
  }

  // Desktop/Workstation detection
  if (ua.includes('windows') || ua.includes('linux') || ua.includes('macintosh')) {
    if (isTouch && width < 1024) return 'tablet';
    return 'workstation';
  }

  // Generic viewport detection
  if (width < 640 || (isTouch && width < 768 && maxDim / minDim > 1.6)) {
    return 'android';
  }
  if (width < 1024 && isTouch) {
    return 'tablet';
  }

  return 'desktop';
}

export function computeAdaptiveProfile(selected: DeviceFormFactor, effective: 'android' | 'workstation' | 'tablet' | 'desktop'): DeviceAdaptiveProfile {
  switch (effective) {
    case 'android':
      return {
        mode: selected,
        effectiveType: 'android',
        displayName: 'Android Mobile Environment',
        isTouchOptimized: true,
        cornerRadiusClass: 'rounded-[36px] sm:rounded-[44px]',
        taskbarType: 'gesture-pill',
        gridColsClass: 'grid-cols-4 gap-3',
        showMobileStatusBar: true,
        showAndroidGesturePill: true,
        windowingBehavior: 'full-sheet',
      };
    case 'tablet':
      return {
        mode: selected,
        effectiveType: 'tablet',
        displayName: 'Adaptive Tablet / Foldable',
        isTouchOptimized: true,
        cornerRadiusClass: 'rounded-[28px]',
        taskbarType: 'tablet-dock',
        gridColsClass: 'grid-cols-5 sm:grid-cols-6 gap-4',
        showMobileStatusBar: true,
        showAndroidGesturePill: false,
        windowingBehavior: 'windowed',
      };
    case 'workstation':
      return {
        mode: selected,
        effectiveType: 'workstation',
        displayName: 'ICOS Adaptive Shell',
        isTouchOptimized: false,
        cornerRadiusClass: 'rounded-none sm:rounded-2xl',
        taskbarType: 'desktop-dock',
        gridColsClass: 'grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-5',
        showMobileStatusBar: false,
        showAndroidGesturePill: false,
        windowingBehavior: 'windowed',
      };
    case 'desktop':
    default:
      return {
        mode: selected,
        effectiveType: 'desktop',
        displayName: 'ICOS Desktop Workstation',
        isTouchOptimized: false,
        cornerRadiusClass: 'rounded-none sm:rounded-2xl',
        taskbarType: 'desktop-dock',
        gridColsClass: 'grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-5',
        showMobileStatusBar: false,
        showAndroidGesturePill: false,
        windowingBehavior: 'windowed',
      };
  }
}

export function useDeviceFormFactor() {
  const [selectedFormFactor, setSelectedFormFactor] = useState<DeviceFormFactor>(() => {
    if (typeof window === 'undefined') return 'auto';
    const saved = window.localStorage.getItem(STORAGE_KEY) as DeviceFormFactor | null;
    return saved || 'auto';
  });

  const [detectedType, setDetectedType] = useState<'android' | 'workstation' | 'tablet' | 'desktop'>('desktop');
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isStandaloneInstalled, setIsStandaloneInstalled] = useState<boolean>(false);

  // Monitor resize & viewport changes
  useEffect(() => {
    const handleCheck = () => {
      setDetectedType(detectNativeDeviceType());
      if (typeof window !== 'undefined') {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true;
        setIsStandaloneInstalled(isStandalone);
      }
    };

    handleCheck();
    window.addEventListener('resize', handleCheck);
    window.addEventListener('orientationchange', handleCheck);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('resize', handleCheck);
      window.removeEventListener('orientationchange', handleCheck);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const effectiveType: 'android' | 'workstation' | 'tablet' | 'desktop' =
    selectedFormFactor === 'auto' ? detectedType : (selectedFormFactor as any);

  const profile = computeAdaptiveProfile(selectedFormFactor, effectiveType);

  const setFormFactor = useCallback((mode: DeviceFormFactor) => {
    setSelectedFormFactor(mode);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch {}
  }, []);

  const triggerInstallPrompt = useCallback(async (): Promise<{ installed: boolean; outcome?: string }> => {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        setDeferredInstallPrompt(null);
        if (choice?.outcome === 'accepted') {
          setIsStandaloneInstalled(true);
          return { installed: true, outcome: 'accepted' };
        }
        return { installed: false, outcome: 'dismissed' };
      } catch (err) {
        return { installed: false, outcome: String(err) };
      }
    }
    return { installed: false, outcome: 'no-prompt' };
  }, [deferredInstallPrompt]);

  return {
    selectedFormFactor,
    effectiveType,
    detectedType,
    profile,
    setFormFactor,
    isInstallable: Boolean(deferredInstallPrompt) || !isStandaloneInstalled,
    hasNativeInstallPrompt: Boolean(deferredInstallPrompt),
    isStandaloneInstalled,
    triggerInstallPrompt,
  };
}
