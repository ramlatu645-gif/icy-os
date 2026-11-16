/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ICOS Vector & Graphic Design Studio
 */

import React, { useState } from 'react';
import { 
  Palette, 
  Download, 
  Copy, 
  Check, 
  X, 
  Sparkles, 
  Sliders, 
  Layers, 
  Code 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface VectorDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  designPrompt?: string;
}

export const VectorDesignModal: React.FC<VectorDesignModalProps> = ({
  isOpen,
  onClose,
  designPrompt = 'Futuristic Quantum Emblem',
}) => {
  const [activePreset, setActivePreset] = useState<'quantum' | 'cyber' | 'minimal' | 'polygon'>('quantum');
  const [themeColor, setThemeColor] = useState<'cyan' | 'violet' | 'emerald' | 'amber'>('cyan');
  const [glowIntensity, setGlowIntensity] = useState(20);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getThemePalette = () => {
    switch (themeColor) {
      case 'violet':
        return { c1: '#c084fc', c2: '#7c3aed', accent: '#e879f9' };
      case 'emerald':
        return { c1: '#34d399', c2: '#059669', accent: '#a7f3d0' };
      case 'amber':
        return { c1: '#fbbf24', c2: '#d97706', accent: '#fde68a' };
      case 'cyan':
      default:
        return { c1: '#00f2fe', c2: '#0072ff', accent: '#38bdf8' };
    }
  };

  const pal = getThemePalette();

  const generateSvgCode = () => {
    if (activePreset === 'quantum') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pal.c1}" />
      <stop offset="100%" stop-color="${pal.c2}" />
    </linearGradient>
    <filter id="qGlow">
      <feGaussianBlur stdDeviation="${glowIntensity / 4}" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect width="400" height="400" rx="40" fill="#070914" />
  <circle cx="200" cy="200" r="120" stroke="url(#qGrad)" stroke-width="2" fill="none" opacity="0.4" stroke-dasharray="6 6" />
  <circle cx="200" cy="200" r="85" stroke="url(#qGrad)" stroke-width="3" fill="none" opacity="0.8" />
  <g transform="translate(200, 200)" filter="url(#qGlow)">
    <polygon points="0,-60 52,30 -52,30" stroke="url(#qGrad)" stroke-width="4" fill="none" />
    <polygon points="0,60 52,-30 -52,-30" stroke="url(#qGrad)" stroke-width="4" fill="none" opacity="0.7" />
    <circle r="14" fill="${pal.accent}" />
  </g>
</svg>`;
    }
    if (activePreset === 'cyber') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="cGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pal.c1}" />
      <stop offset="100%" stop-color="${pal.c2}" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="40" fill="#070914" />
  <g transform="translate(200, 200)">
    <rect x="-90" y="-90" width="180" height="180" rx="30" stroke="url(#cGrad)" stroke-width="4" fill="none" transform="rotate(45)" />
    <rect x="-60" y="-60" width="120" height="120" rx="20" stroke="${pal.accent}" stroke-width="2" fill="none" opacity="0.6" />
    <circle r="36" fill="url(#cGrad)" opacity="0.2" />
    <path d="M-20,-20 L20,20 M-20,20 L20,-20" stroke="${pal.c1}" stroke-width="4" stroke-linecap="round" />
  </g>
</svg>`;
    }
    if (activePreset === 'polygon') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="pGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pal.c1}" />
      <stop offset="100%" stop-color="${pal.c2}" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="40" fill="#070914" />
  <g transform="translate(200, 200)">
    <polygon points="0,-100 86,-50 86,50 0,100 -86,50 -86,-50" stroke="url(#pGrad)" stroke-width="4" fill="none" />
    <polygon points="0,-60 52,-30 52,30 0,60 -52,30 -52,-30" fill="url(#pGrad)" opacity="0.25" />
    <circle r="12" fill="${pal.accent}" />
  </g>
</svg>`;
    }
    // Minimalist
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="mGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pal.c1}" />
      <stop offset="100%" stop-color="${pal.c2}" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="40" fill="#070914" />
  <g transform="translate(200, 200)">
    <circle r="80" stroke="url(#mGrad)" stroke-width="8" fill="none" />
    <circle cx="45" cy="-45" r="16" fill="${pal.accent}" />
    <path d="M-40,0 L40,0" stroke="${pal.c1}" stroke-width="6" stroke-linecap="round" />
  </g>
</svg>`;
  };

  const svgContent = generateSvgCode();

  const handleCopySvg = () => {
    navigator.clipboard.writeText(svgContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icyos-design-${activePreset}.svg`;
    a.click();
    URL.revokeObjectURL(url);
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
          className="w-full max-w-3xl h-[80vh] bg-[#0c0e1a]/95 border border-cyan-500/30 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-3xl text-left flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-14 px-5 border-b border-white/10 bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-purple-950/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                <Palette className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-wide">ICOS Vector Design Studio</span>
                <span className="text-[10px] text-cyan-300 font-mono">{designPrompt}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCode(!showCode)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  showCode ? 'bg-cyan-600 text-white shadow' : 'bg-white/5 text-white/60 hover:text-white'
                }`}
                title="Inspect SVG Code"
              >
                <Code className="w-4 h-4" />
              </button>

              <button
                onClick={handleCopySvg}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Copy SVG"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              <button
                onClick={handleDownloadSvg}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                title="Download SVG"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader Controls */}
          <div className="px-5 py-2.5 border-b border-white/5 bg-black/30 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0">
            {/* Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-white/40 mr-1">DESIGN:</span>
              {(['quantum', 'cyber', 'polygon', 'minimal'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePreset(p)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                    activePreset === p ? 'bg-cyan-600 text-white shadow' : 'bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-white/40 mr-1">PALETTE:</span>
              {(['cyan', 'violet', 'emerald', 'amber'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setThemeColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                    themeColor === c ? 'scale-125 border-white shadow-glow' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor:
                      c === 'cyan' ? '#00f2fe' : c === 'violet' ? '#c084fc' : c === 'emerald' ? '#34d399' : '#fbbf24',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Canvas or Code */}
          <div className="flex-1 bg-[#070914] flex items-center justify-center p-6 overflow-hidden relative">
            {showCode ? (
              <textarea
                readOnly
                value={svgContent}
                className="w-full h-full p-4 bg-transparent text-cyan-300 font-mono text-xs focus:outline-none resize-none no-scrollbar leading-relaxed"
              />
            ) : (
              <div 
                className="w-full max-w-[380px] aspect-square flex items-center justify-center rounded-3xl overflow-hidden shadow-2xl border border-white/10"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
