/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ICOS Device Installation & Hardware Calibration Wizard
 */

import React, { useState } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Laptop, 
  Download, 
  Check, 
  X, 
  Sparkles, 
  Sliders, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  Maximize2,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceFormFactor, useDeviceFormFactor } from '../../hooks/useDeviceFormFactor';

interface DeviceSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  formFactorState: ReturnType<typeof useDeviceFormFactor>;
}

export const DeviceSetupModal: React.FC<DeviceSetupModalProps> = ({
  isOpen,
  onClose,
  formFactorState,
}) => {
  const { 
    selectedFormFactor, 
    effectiveType, 
    detectedType, 
    profile, 
    setFormFactor, 
    hasNativeInstallPrompt,
    isStandaloneInstalled,
    triggerInstallPrompt 
  } = formFactorState;

  const [installStatus, setInstallStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (hasNativeInstallPrompt) {
      setInstallStatus('Launching native device installation prompt...');
      const res = await triggerInstallPrompt();
      if (res.installed) {
        setInstallStatus('✓ Installed successfully to device home screen & launcher!');
      } else {
        setInstallStatus('Installation dialog closed.');
      }
    } else {
      setInstallStatus(
        effectiveType === 'android'
          ? 'On Android: Tap browser menu (⋮) -> "Add to Home screen" or "Install App".'
          : 'On Desktop: In Chrome or Edge, click the (⊕) Install button in the address bar.'
      );
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xl select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="w-full max-w-2xl bg-[#0c0e1a]/95 border border-cyan-500/30 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-3xl text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-950/60 via-purple-950/40 to-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-lg">
                <Cpu className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-wide">ICOS Device Engine & Form Factor</h3>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                    Full-Stack Installable
                  </span>
                </div>
                <p className="text-xs text-white/60">
                  Detected Host: <strong className="text-white capitalize">{detectedType}</strong> · Active Mode: <strong className="text-cyan-300 capitalize">{effectiveType}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6 no-scrollbar">
            {/* Install to Device Section */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-blue-950/20 border border-cyan-500/30 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white">Install ICOS to Hardware Device</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Install ICOS directly to your Android device, Desktop PC, or Mac. It runs standalone with full hardware access, native screen radius, offline boot, and device-adaptive layout.
                  </p>
                </div>

                <button
                  onClick={handleInstallClick}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>{isStandaloneInstalled ? 'Installed on Device' : 'Install to Device'}</span>
                </button>
              </div>

              {installStatus && (
                <div className="text-xs p-3 rounded-xl bg-white/5 border border-white/10 text-cyan-200">
                  {installStatus}
                </div>
              )}
            </div>

            {/* Form Factor Adaptation Picker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/80 tracking-wide uppercase font-mono">
                  Adaptive Device Profiles
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">
                  Auto-Scales & Adapts Radius Live
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Auto */}
                <button
                  onClick={() => setFormFactor('auto')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer text-center ${
                    selectedFormFactor === 'auto'
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <span className="text-xs font-semibold">Auto-Detect</span>
                  <span className="text-[10px] text-white/40">Matches Screen</span>
                </button>

                {/* Android Phone */}
                <button
                  onClick={() => setFormFactor('android')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer text-center ${
                    selectedFormFactor === 'android'
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-semibold">Android Phone</span>
                  <span className="text-[10px] text-white/40">38px Radius & Pill</span>
                </button>

                {/* Windows Laptop/PC */}
                <button
                  onClick={() => setFormFactor('workstation')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer text-center ${
                    selectedFormFactor === 'workstation'
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Laptop className="w-5 h-5 text-blue-400" />
                  <span className="text-xs font-semibold">Desktop Mode</span>
                  <span className="text-[10px] text-white/40">Center Taskbar</span>
                </button>

                {/* Tablet / Foldable */}
                <button
                  onClick={() => setFormFactor('tablet')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer text-center ${
                    selectedFormFactor === 'tablet'
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Tablet className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-semibold">Tablet Mode</span>
                  <span className="text-[10px] text-white/40">Touch Dock & Split</span>
                </button>
              </div>
            </div>

            {/* Profile Specifications */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Active Device Layout:</span>
                <span className="font-semibold text-white font-mono">{profile.displayName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Physical Corner Radius:</span>
                <span className="font-semibold text-cyan-300 font-mono">
                  {effectiveType === 'android' ? 'Android Curved (38px)' : effectiveType === 'tablet' ? 'Tablet Curved (28px)' : 'Desktop Ergonomic (16px / Flat)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Input Optimization:</span>
                <span className="font-semibold text-white font-mono">
                  {profile.isTouchOptimized ? 'Touch & Gestures' : 'Mouse, Trackpad & Keyboard'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Taskbar Architecture:</span>
                <span className="font-semibold text-white font-mono">{profile.taskbarType}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
            <span className="text-[11px] font-mono text-white/40">
              ICOS Multi-Architecture Platform v2.0
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
