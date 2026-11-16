/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ICOS AI Code Runner & Live Sandbox Studio
 */

import React, { useState } from 'react';
import { 
  Code, 
  Play, 
  Copy, 
  Check, 
  X, 
  ExternalLink, 
  Terminal, 
  RotateCcw, 
  Sparkles,
  Layers,
  FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CodeRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  initialLanguage?: string;
  title?: string;
}

const DEFAULT_SAMPLE_CODE = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      background: #080a14;
      color: #00d2ff;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    .orb {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00f2fe, #4facfe, #6b11ff);
      box-shadow: 0 0 50px rgba(0, 242, 254, 0.6);
      animation: pulse 3s infinite alternate ease-in-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.9) rotate(0deg); filter: hue-rotate(0deg); }
      100% { transform: scale(1.15) rotate(180deg); filter: hue-rotate(90deg); }
    }
    h2 { margin-top: 24px; font-weight: 600; letter-spacing: 2px; }
    p { color: rgba(255,255,255,0.6); font-size: 13px; }
  </style>
</head>
<body>
  <div class="orb"></div>
  <h2>ICOS RUNNER</h2>
  <p>Live Code Execution Sandbox</p>
</body>
</html>`;

export const CodeRunnerModal: React.FC<CodeRunnerModalProps> = ({
  isOpen,
  onClose,
  initialCode = DEFAULT_SAMPLE_CODE,
  initialLanguage = 'html',
  title = 'ICOS Code Studio & Sandbox'
}) => {
  const [code, setCode] = useState(initialCode);
  const [activeTab, setActiveTab] = useState<'preview' | 'editor'>('preview');
  const [copied, setCopied] = useState(false);
  const [executionKey, setExecutionKey] = useState(0);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRun = () => {
    setExecutionKey((prev) => prev + 1);
    setActiveTab('preview');
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
          className="w-full max-w-4xl h-[80vh] bg-[#0c0e1a]/95 border border-cyan-500/30 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-3xl text-left flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-14 px-5 border-b border-white/10 bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-purple-950/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                <Code className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-wide">{title}</span>
                <span className="text-[10px] text-cyan-300 font-mono">Live Multi-Language Sandbox</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-white/5 border border-white/10 p-1 rounded-xl flex items-center gap-1 text-xs">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'editor' ? 'bg-cyan-600 text-white shadow' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Code Editor
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'preview' ? 'bg-cyan-600 text-white shadow' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Live Run Preview
                </button>
              </div>

              <button
                onClick={handleRun}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                title="Run / Reload Sandbox"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Run</span>
              </button>

              <button
                onClick={handleCopy}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Copy Code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden relative bg-[#070912]">
            {activeTab === 'editor' ? (
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-full p-5 bg-transparent text-cyan-200 font-mono text-xs sm:text-sm focus:outline-none resize-none no-scrollbar leading-relaxed"
                spellCheck={false}
              />
            ) : (
              <iframe
                key={executionKey}
                title="Code Sandbox Execution"
                srcDoc={code}
                sandbox="allow-scripts allow-modals"
                className="w-full h-full border-none bg-white"
              />
            )}
          </div>

          {/* Footer Bar */}
          <div className="h-10 px-5 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] font-mono text-white/40 shrink-0">
            <span>Runtime: HTML5 / JavaScript / WebGL Sandbox</span>
            <span>Status: Ready & Safe Sandbox Isolated</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
