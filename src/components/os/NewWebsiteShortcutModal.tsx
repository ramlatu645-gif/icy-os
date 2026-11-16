/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Globe, X, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RegisteredApplication } from '../../types/launcher';

export interface NewWebsiteShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWebsiteShortcut: (app: RegisteredApplication) => void;
}

const PRESET_SUGGESTIONS = [
  { name: 'Google', url: 'https://google.com', domain: 'google.com' },
  { name: 'GitHub', url: 'https://github.com', domain: 'github.com' },
  { name: 'Wikipedia', url: 'https://wikipedia.org', domain: 'wikipedia.org' },
  { name: 'YouTube', url: 'https://youtube.com', domain: 'youtube.com' },
  { name: 'Reddit', url: 'https://reddit.com', domain: 'reddit.com' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com', domain: 'stackoverflow.com' },
];

export const NewWebsiteShortcutModal: React.FC<NewWebsiteShortcutModalProps> = ({
  isOpen,
  onClose,
  onCreateWebsiteShortcut,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [customName, setCustomName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleCreate = (overrideUrl?: string, overrideName?: string) => {
    const rawUrl = (overrideUrl || urlInput).trim();
    if (!rawUrl) {
      setErrorMsg('Please enter a valid website URL.');
      return;
    }

    let normalizedUrl = rawUrl;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const parsedUrl = new URL(normalizedUrl);
      const domain = parsedUrl.hostname.replace(/^www\./, '');

      if (!domain || domain.length < 3) {
        setErrorMsg('Invalid URL format. Example: https://github.com');
        return;
      }

      // Generate clean default name from domain if customName not provided
      let derivedName = overrideName || customName.trim();
      if (!derivedName) {
        const parts = domain.split('.');
        const mainPart = parts[0] || 'Website';
        derivedName = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
      }

      // High quality Favicon URL from Google Favicon API
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      const appId = `com.icy.web.${domain.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

      const newApp: RegisteredApplication = {
        id: appId,
        name: derivedName,
        description: `Web shortcut target for ${normalizedUrl}`,
        iconResource: faviconUrl,
        version: '1.0.0',
        publisher: domain,
        source: 'third-party',
        installed: true,
        available: true,
        filesPresent: true,
        supportedPlatforms: ['web', 'windows', 'macos', 'linux', 'android', 'ios'],
        launchMethod: 'external-web-url',
        verifiedLaunchTarget: normalizedUrl,
        signatureVerified: true,
        permissions: ['network:outbound'],
        capabilities: ['web-shortcut', 'pwa'],
        runtimeType: 'web-app',
        installedAt: new Date().toISOString(),
      };

      onCreateWebsiteShortcut(newApp);
      setUrlInput('');
      setCustomName('');
      setErrorMsg('');
      onClose();
    } catch {
      setErrorMsg('Failed to parse website URL. Please verify format (e.g., github.com).');
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-lg bg-[#0d0f1a]/95 border border-white/20 rounded-3xl shadow-2xl p-6 overflow-hidden backdrop-blur-3xl text-white select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create New Website Shortcut</h3>
                <p className="text-xs text-white/60">Adds a shortcut to your desktop & web browser</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <div className="py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                Website URL <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                  placeholder="e.g. github.com, wikipedia.org, google.com"
                  className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/15 focus:border-emerald-400 text-white text-sm focus:outline-none placeholder:text-white/30"
                  autoFocus
                />
              </div>
              {errorMsg && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{errorMsg}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                Shortcut Display Name (Optional)
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Auto-detected from URL if left empty"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/15 focus:border-emerald-400 text-white text-sm focus:outline-none placeholder:text-white/30"
              />
            </div>

            {/* Quick Suggestions */}
            <div>
              <span className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2 font-mono">
                Popular Web Apps & Services
              </span>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug.name}
                    onClick={() => handleCreate(sug.url, sug.name)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-emerald-600/30 border border-white/10 hover:border-emerald-400/50 flex items-center gap-2 text-xs font-medium text-white/90 hover:text-white cursor-pointer transition-all truncate"
                  >
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${sug.domain}&sz=64`}
                      alt={sug.name}
                      className="w-4 h-4 rounded shrink-0 object-contain"
                    />
                    <span className="truncate">{sug.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => handleCreate()}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Add to Desktop</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
