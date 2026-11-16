/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  X, 
  Info, 
  ShieldCheck, 
  Smartphone, 
  Apple, 
  Monitor, 
  Terminal, 
  Globe, 
  Lock, 
  Cpu, 
  Calendar,
  ExternalLink,
  Tag,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RegisteredApplication } from '../../types/launcher';

interface AppInfoModalProps {
  app: RegisteredApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (app: RegisteredApplication) => void;
  onUninstall?: (appId: string) => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({
  app,
  isOpen,
  onClose,
  onLaunch,
  onUninstall,
}) => {
  if (!isOpen || !app) return null;

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'android':
        return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
      case 'ios':
        return <Apple className="w-3.5 h-3.5 text-slate-300" />;
      case 'windows':
        return <Monitor className="w-3.5 h-3.5 text-sky-400" />;
      case 'linux':
      case 'macos':
        return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-2xl select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="w-full max-w-lg bg-[#0e101c]/95 border border-white/20 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-3xl text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-slate-950/40 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-mono font-bold text-2xl text-white shadow-xl shrink-0">
                {app.name[0]}
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-white leading-tight">{app.name}</h3>
                <p className="text-xs text-white/60">{app.publisher} · v{app.version}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Signature Verified
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-mono">
                    {app.source}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Details Body */}
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 no-scrollbar">
            {app.description && (
              <div>
                <h4 className="text-xs font-semibold text-white/50 mb-1">DESCRIPTION</h4>
                <p className="text-xs text-white/80 leading-relaxed bg-white/5 p-3 rounded-2xl border border-white/5">
                  {app.description}
                </p>
              </div>
            )}

            {/* Technical Specifications */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[10px] font-mono text-white/40 block">PACKAGE ID</span>
                <span className="font-mono text-blue-300 text-xs truncate block">{app.id}</span>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[10px] font-mono text-white/40 block">LAUNCH METHOD</span>
                <span className="font-mono text-white text-xs truncate block">{app.launchMethod}</span>
              </div>
            </div>

            {/* Verified Launch Target */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-white/40 block">VERIFIED TARGET PROTOCOL</span>
              <span className="font-mono text-cyan-300 text-xs truncate block">{app.verifiedLaunchTarget}</span>
            </div>

            {/* Supported Platforms */}
            <div>
              <h4 className="text-xs font-semibold text-white/50 mb-2">SUPPORTED PLATFORMS</h4>
              <div className="flex flex-wrap gap-2">
                {app.supportedPlatforms.map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/10 text-xs text-white flex items-center gap-1.5 font-mono uppercase text-[11px]"
                  >
                    {getPlatformIcon(p)}
                    <span>{p}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Granted Permissions */}
            <div>
              <h4 className="text-xs font-semibold text-white/50 mb-2">PERMISSIONS & CAPABILITIES</h4>
              <div className="flex flex-wrap gap-1.5">
                {app.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-[11px] font-mono"
                  >
                    {perm}
                  </span>
                ))}
                {app.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-[11px] font-mono"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/40">
              Installed: {new Date(app.installedAt || Date.now()).toLocaleDateString()}
            </span>

            <div className="flex items-center gap-2">
              {onUninstall && (
                <button
                  onClick={() => {
                    onUninstall(app.id);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-300 hover:text-rose-100 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Permanently delete application from ICOS"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Uninstall</span>
                </button>
              )}
              <button
                onClick={() => {
                  onLaunch(app);
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Launch App</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
