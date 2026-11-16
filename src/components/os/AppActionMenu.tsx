/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Info, 
  Trash2, 
  Pin, 
  Sidebar as SidebarIcon, 
  Play, 
  X, 
  ShieldCheck, 
  Smartphone, 
  Apple, 
  Monitor, 
  Terminal, 
  Globe,
  MinusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RegisteredApplication } from '../../types/launcher';

interface AppActionMenuProps {
  app: RegisteredApplication;
  isOpen: boolean;
  isPinnedToTaskbar: boolean;
  isPinnedToSidebar: boolean;
  onClose: () => void;
  onLaunch: (app: RegisteredApplication) => void;
  onShowInfo: (app: RegisteredApplication) => void;
  onRemoveFromDesktop: (appId: string) => void;
  onUninstall: (appId: string) => void;
  onTogglePinTaskbar: (appId: string) => void;
  onTogglePinSidebar: (appId: string) => void;
}

export const AppActionMenu: React.FC<AppActionMenuProps> = ({
  app,
  isOpen,
  isPinnedToTaskbar,
  isPinnedToSidebar,
  onClose,
  onLaunch,
  onShowInfo,
  onRemoveFromDesktop,
  onUninstall,
  onTogglePinTaskbar,
  onTogglePinSidebar,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl select-none"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm bg-[#0e101c]/95 border border-white/20 rounded-3xl shadow-2xl p-5 overflow-hidden backdrop-blur-3xl text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Card */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/15 flex items-center justify-center font-mono font-bold text-lg text-white shadow-lg shrink-0">
                {app.name[0]}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-bold text-white truncate">{app.name}</span>
                <span className="text-xs text-white/50 truncate">{app.publisher} · v{app.version}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Launch Action */}
          <button
            onClick={() => {
              onLaunch(app);
              onClose();
            }}
            className="w-full py-2.5 px-4 mb-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-between shadow-lg shadow-blue-600/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 fill-white" />
              <span>Open Application</span>
            </div>
            <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-md">Launch</span>
          </button>

          {/* Requested 5 Specific Features List */}
          <div className="space-y-1 text-xs">
            {/* 1. App info */}
            <button
              onClick={() => {
                onShowInfo(app);
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white flex items-center justify-between transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="font-medium">1. App info</span>
              </div>
              <span className="text-[10px] text-white/40 font-mono">Details</span>
            </button>

            {/* 2. Remove */}
            <button
              onClick={() => {
                onRemoveFromDesktop(app.id);
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-amber-500/20 text-amber-200 flex items-center justify-between transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <MinusCircle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="font-medium">2. Remove from Desktop</span>
              </div>
              <span className="text-[10px] text-amber-300/60 font-mono">Hide</span>
            </button>

            {/* 3. Uninstall */}
            <button
              onClick={() => {
                onUninstall(app.id);
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-rose-500/25 active:bg-rose-600/35 text-rose-300 hover:text-rose-100 flex items-center justify-between transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-rose-400 group-hover:scale-110 group-hover:text-rose-300 transition-all" />
                <span className="font-medium">3. Uninstall</span>
              </div>
              <span className="text-[10px] text-rose-400/90 font-mono bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">Delete</span>
            </button>

            {/* 4. Pin to taskbar */}
            <button
              onClick={() => {
                onTogglePinTaskbar(app.id);
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white flex items-center justify-between transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Pin className={`w-4 h-4 ${isPinnedToTaskbar ? 'text-blue-400 fill-blue-400' : 'text-blue-400'} group-hover:scale-110 transition-transform`} />
                <span className="font-medium">
                  {isPinnedToTaskbar ? '4. Unpin from taskbar' : '4. Pin to taskbar'}
                </span>
              </div>
              <span className="text-[10px] text-blue-300/60 font-mono">
                {isPinnedToTaskbar ? 'Pinned' : 'Taskbar'}
              </span>
            </button>

            {/* 5. Pin to sidebar */}
            <button
              onClick={() => {
                onTogglePinSidebar(app.id);
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white flex items-center justify-between transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <SidebarIcon className={`w-4 h-4 ${isPinnedToSidebar ? 'text-purple-400 fill-purple-400' : 'text-purple-400'} group-hover:scale-110 transition-transform`} />
                <span className="font-medium">
                  {isPinnedToSidebar ? '5. Unpin from sidebar' : '5. Pin to sidebar'}
                </span>
              </div>
              <span className="text-[10px] text-purple-300/60 font-mono">
                {isPinnedToSidebar ? 'Pinned' : 'Sidebar'}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
