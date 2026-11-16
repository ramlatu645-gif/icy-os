/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SupportedPlatform,
} from '../types/launcher';
import {
  NativeAndroidBridge,
  NativeDesktopBridge,
  NativeIOSBridge,
} from './platformLauncher';

/**
 * Global window contract for native mobile (Capacitor Android/iOS) and
 * native desktop (Electron contextBridge) shells when IC App Launcher runs as an
 * installed native application.
 *
 * Security rule:
 * - Neither `window.__IC_APP_LAUNCHER_CAPACITOR_BRIDGE__` nor `window.__IC_APP_LAUNCHER_DESKTOP_BRIDGE__`
 *   exists in the standard web browser preview.
 * - Adapters never fabricate or mock these bridges in the browser; they are
 *   exclusively populated by the native host process (Android/iOS native plugin
 *   or Electron preload `contextBridge.exposeInMainWorld`).
 */
export interface CapacitorNativePluginContract {
  platform: 'android' | 'ios';
  launchPackageIntent?: (
    packageId: string,
    intentUri?: string
  ) => Promise<{
    launched: boolean;
    confirmed: boolean;
    errorReason?: string;
  }>;
  openUniversalLinkOrScheme?: (url: string) => Promise<{
    opened: boolean;
    confirmed: boolean;
    errorReason?: string;
  }>;
  getSecureItem?: (key: string) => Promise<string | null>;
  setSecureItem?: (key: string, value: string) => Promise<void>;
  removeSecureItem?: (key: string) => Promise<void>;
}

export interface DesktopContextBridgeContract {
  platform: 'windows' | 'macos' | 'linux';
  launchProtocolOrBinary: (
    method: 'desktop-protocol' | 'native-binary',
    target: string
  ) => Promise<{
    launched: boolean;
    confirmed: boolean;
    errorReason?: string;
  }>;
  getSecureItem?: (key: string) => Promise<string | null>;
  setSecureItem?: (key: string, value: string) => Promise<void>;
  removeSecureItem?: (key: string) => Promise<void>;
}

declare global {
  interface Window {
    __IC_APP_LAUNCHER_CAPACITOR_BRIDGE__?: CapacitorNativePluginContract;
    __IC_APP_LAUNCHER_DESKTOP_BRIDGE__?: DesktopContextBridgeContract;
  }
}

/**
 * Discovers any genuine native launch bridges injected by the host runtime.
 * Returns `null` for platforms whose native shell is not active.
 */
export function discoverNativeLaunchBridges(): {
  activeNativePlatform: SupportedPlatform | null;
  androidBridge: NativeAndroidBridge | null;
  iosBridge: NativeIOSBridge | null;
  desktopBridges: Partial<
    Record<'windows' | 'macos' | 'linux', NativeDesktopBridge | null>
  >;
} {
  if (typeof window === 'undefined') {
    return {
      activeNativePlatform: null,
      androidBridge: null,
      iosBridge: null,
      desktopBridges: {},
    };
  }

  const capBridge = window.__IC_APP_LAUNCHER_CAPACITOR_BRIDGE__;
  if (
    capBridge &&
    capBridge.platform === 'android' &&
    typeof capBridge.launchPackageIntent === 'function'
  ) {
    const fn = capBridge.launchPackageIntent.bind(capBridge);
    return {
      activeNativePlatform: 'android',
      androidBridge: {
        launchPackageIntent: (packageId: string, intentUri?: string) =>
          fn(packageId, intentUri),
      },
      iosBridge: null,
      desktopBridges: {},
    };
  }

  if (
    capBridge &&
    capBridge.platform === 'ios' &&
    typeof capBridge.openUniversalLinkOrScheme === 'function'
  ) {
    const fn = capBridge.openUniversalLinkOrScheme.bind(capBridge);
    return {
      activeNativePlatform: 'ios',
      androidBridge: null,
      iosBridge: {
        openUniversalLinkOrScheme: (url: string) => fn(url),
      },
      desktopBridges: {},
    };
  }

  const deskBridge = window.__IC_APP_LAUNCHER_DESKTOP_BRIDGE__;
  if (
    deskBridge &&
    (deskBridge.platform === 'windows' ||
      deskBridge.platform === 'macos' ||
      deskBridge.platform === 'linux') &&
    typeof deskBridge.launchProtocolOrBinary === 'function'
  ) {
    const fn = deskBridge.launchProtocolOrBinary.bind(deskBridge);
    const bridgeObj: NativeDesktopBridge = {
      platform: deskBridge.platform,
      launchProtocolOrBinary: (method, target) => fn(method, target),
    };
    return {
      activeNativePlatform: deskBridge.platform,
      androidBridge: null,
      iosBridge: null,
      desktopBridges: {
        [deskBridge.platform]: bridgeObj,
      },
    };
  }

  return {
    activeNativePlatform: null,
    androidBridge: null,
    iosBridge: null,
    desktopBridges: {},
  };
}
