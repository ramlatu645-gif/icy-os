/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  FolderPlus, 
  FileText, 
  Globe, 
  ExternalLink, 
  RefreshCw, 
  Palette, 
  Terminal, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DesktopContextMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onCreateFolder: () => void;
  onCreatePdf: () => void;
  onCreateWebsiteShortcut: () => void;
  onCreateShortcut: () => void;
  onRefreshDesktop: () => void;
  onArrangeIcons?: () => void;
  onOpenSettings: () => void;
  onOpenTerminal?: () => void;
}

export const DesktopContextMenu: React.FC<DesktopContextMenuProps> = ({
  position,
  onClose,
  onCreateFolder,
  onCreatePdf,
  onCreateWebsiteShortcut,
  onCreateShortcut,
  onRefreshDesktop,
  onArrangeIcons,
  onOpenSettings,
  onOpenTerminal,
}) => {
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position so context menu doesn't overflow screen edges
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const adjustedX = Math.min(position.x, screenWidth - 240);
  const adjustedY = Math.min(position.y, screenHeight - 320);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{ top: adjustedY, left: adjustedX }}
        className="fixed z-50 w-60 p-1.5 rounded-2xl bg-[#0d0f19]/90 border border-white/20 shadow-2xl backdrop-blur-3xl text-white select-none text-xs font-medium"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Top Header Label */}
        <div className="px-3 py-1.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between border-b border-white/10 mb-1 font-mono">
          <span>ICOS Desktop</span>
          <Sparkles className="w-3 h-3 text-cyan-400" />
        </div>

        {/* 1. NEW Submenu Item (ICOS Hover & Click Flyout) */}
        <div 
          className="relative"
          onMouseEnter={() => setIsSubmenuOpen(true)}
          onMouseLeave={() => setIsSubmenuOpen(false)}
        >
          <button
            onClick={() => setIsSubmenuOpen((prev) => !prev)}
            className={`w-full px-3 py-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
              isSubmenuOpen ? 'bg-blue-600/40 text-white' : 'hover:bg-white/10 text-white/90'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-white">New</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-white/50" />
          </button>

          {/* Submenu Options */}
          {isSubmenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.12 }}
              className="absolute left-full top-0 ml-1.5 w-56 p-1.5 rounded-2xl bg-[#0d0f19]/95 border border-white/20 shadow-2xl backdrop-blur-3xl space-y-1 text-xs"
            >
              <button
                onClick={() => {
                  onCreateShortcut();
                  onClose();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-blue-600/30 text-white/90 hover:text-white transition-all cursor-pointer text-left"
              >
                <ExternalLink className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Create a new shortcut</span>
              </button>

              <button
                onClick={() => {
                  onCreateFolder();
                  onClose();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-blue-600/30 text-white/90 hover:text-white transition-all cursor-pointer text-left"
              >
                <FolderPlus className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Create a new folder</span>
              </button>

              <button
                onClick={() => {
                  onCreatePdf();
                  onClose();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-blue-600/30 text-white/90 hover:text-white transition-all cursor-pointer text-left"
              >
                <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Create a new PDF</span>
              </button>

              <button
                onClick={() => {
                  onCreateWebsiteShortcut();
                  onClose();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-blue-600/30 text-white/90 hover:text-white transition-all cursor-pointer text-left font-medium"
              >
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Create a new website shortcut</span>
              </button>
            </motion.div>
          )}
        </div>

        <div className="h-px bg-white/10 my-1" />

        {/* 2. REFRESH DESKTOP */}
        <button
          onClick={() => {
            onRefreshDesktop();
            onClose();
          }}
          className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-white/90 hover:text-white transition-all cursor-pointer text-left"
        >
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          <span>Refresh Desktop</span>
        </button>

        {/* 2b. ARRANGE DESKTOP ICONS */}
        {onArrangeIcons ? (
          <button
            onClick={() => {
              onArrangeIcons();
              onClose();
            }}
            className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-white/90 hover:text-white transition-all cursor-pointer text-left"
          >
            <LayoutGrid className="w-4 h-4 text-cyan-400" />
            <span>Auto-Arrange Icons</span>
          </button>
        ) : null}

        {/* 3. PERSONALIZE WALLPAPER */}
        <button
          onClick={() => {
            onOpenSettings();
            onClose();
          }}
          className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-white/90 hover:text-white transition-all cursor-pointer text-left"
        >
          <Palette className="w-4 h-4 text-purple-400" />
          <span>Personalize Wallpaper & Theme</span>
        </button>

        {/* 4. OPEN TERMINAL (only when a terminal app is installed) */}
        {onOpenTerminal ? (
          <button
            onClick={() => {
              onOpenTerminal();
              onClose();
            }}
            className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-white/90 hover:text-white transition-all cursor-pointer text-left"
          >
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>Open ICY Terminal</span>
          </button>
        ) : null}

        {/* 5. DISPLAY SETTINGS */}
        <button
          onClick={() => {
            onOpenSettings();
            onClose();
          }}
          className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-white/90 hover:text-white transition-all cursor-pointer text-left"
        >
          <SlidersHorizontal className="w-4 h-4 text-sky-400" />
          <span>Display Settings</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
