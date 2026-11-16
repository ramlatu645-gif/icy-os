/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

export interface RealHardwareStatus {
  // Battery Properties
  batteryLevel: number; // 0 - 100 percentage
  isCharging: boolean;
  batterySupported: boolean;
  
  // Wi-Fi / Network Properties
  isOnline: boolean;
  networkType: string; // 'wifi', 'cellular', 'ethernet', '4g', etc.
  downlinkMbps: number;
  rttMs: number;

  // Sound & Brightness Controls
  volume: number; // 0 - 100
  isMuted: boolean;
  brightness: number; // 10 - 100
  setVolume: (val: number) => void;
  setIsMuted: (val: boolean) => void;
  setBrightness: (val: number) => void;
  toggleWifi: () => void;
}

export function useDeviceHardwareStatus(): RealHardwareStatus {
  // Battery state
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState<boolean>(true);
  const [batterySupported, setBatterySupported] = useState<boolean>(false);

  // Network state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [networkType, setNetworkType] = useState<string>('Wi-Fi');
  const [downlinkMbps, setDownlinkMbps] = useState<number>(10);
  const [rttMs, setRttMs] = useState<number>(15);

  // Audio & Display
  const [volume, setVolumeState] = useState<number>(80);
  const [isMuted, setIsMutedState] = useState<boolean>(false);
  const [brightness, setBrightnessState] = useState<number>(100);

  // 1. Real Battery Hardware Integration (`navigator.getBattery()`)
  useEffect(() => {
    let batteryObj: any = null;

    const updateBatteryInfo = (b: any) => {
      if (!b) return;
      const levelPercent = Math.round((b.level ?? 1) * 100);
      setBatteryLevel(levelPercent);
      setIsCharging(Boolean(b.charging));
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      setBatterySupported(true);
      (navigator as any)
        .getBattery()
        .then((b: any) => {
          batteryObj = b;
          updateBatteryInfo(b);

          b.addEventListener('levelchange', () => updateBatteryInfo(b));
          b.addEventListener('chargingchange', () => updateBatteryInfo(b));
        })
        .catch(() => {
          setBatterySupported(false);
        });
    }

    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener?.('levelchange', () => {});
        batteryObj.removeEventListener?.('chargingchange', () => {});
      }
    };
  }, []);

  // 2. Real Network & Wi-Fi Hardware Integration (`navigator.onLine` & `NetworkInformation`)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    const updateConnectionInfo = () => {
      if (connection) {
        const type = connection.type || connection.effectiveType || 'Wi-Fi';
        setNetworkType(
          type.toLowerCase().includes('wifi')
            ? 'Wi-Fi'
            : type.toUpperCase()
        );
        if (connection.downlink) setDownlinkMbps(connection.downlink);
        if (connection.rtt) setRttMs(connection.rtt);
      }
    };

    if (connection) {
      updateConnectionInfo();
      connection.addEventListener?.('change', updateConnectionInfo);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener?.('change', updateConnectionInfo);
      }
    };
  }, []);

  // 3. Real Display Brightness Filter Application
  const setBrightness = (val: number) => {
    const clamped = Math.max(10, Math.min(100, val));
    setBrightnessState(clamped);
    if (typeof document !== 'undefined') {
      // Applies real CSS brightness filter to simulate real display dimming / brightening
      document.documentElement.style.filter = `brightness(${clamped}%)`;
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVolumeState(clamped);
    if (clamped === 0) setIsMutedState(true);
    else if (isMuted) setIsMutedState(false);
  };

  const setIsMuted = (muted: boolean) => {
    setIsMutedState(muted);
  };

  const toggleWifi = () => {
    setIsOnline((prev) => !prev);
  };

  return {
    batteryLevel,
    isCharging,
    batterySupported,
    isOnline,
    networkType,
    downlinkMbps,
    rttMs,
    volume,
    isMuted,
    brightness,
    setVolume,
    setIsMuted,
    setBrightness,
    toggleWifi,
  };
}
