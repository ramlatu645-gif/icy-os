/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Highlighter, 
  PenTool, 
  Sparkles,
  Layers
} from 'lucide-react';

export interface IcyPdfStudioProps {
  documentName?: string;
}

export const IcyPdfStudio: React.FC<IcyPdfStudioProps> = ({ 
  documentName = 'Document.pdf' 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 4;
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTool, setActiveTool] = useState<'select' | 'highlight' | 'pen'>('select');
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  return (
    <div className="w-full h-full flex flex-col bg-[#12131f] text-white font-sans select-none overflow-hidden relative">
      {statusNotification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-blue-600/90 backdrop-blur-md text-white text-xs rounded-xl shadow-xl flex items-center gap-2 border border-blue-400/40">
          <span>{statusNotification}</span>
          <button 
            onClick={() => setStatusNotification(null)}
            className="ml-2 hover:bg-white/20 px-1 rounded text-[10px]"
          >
            ✕
          </button>
        </div>
      )}
      {/* PDF Header Toolbar */}
      <div className="h-12 px-4 bg-[#0a0b14] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs">
            {documentName}
          </span>
        </div>

        {/* Page & Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono px-1">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-white/15" />

          <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
              className="p-1 rounded hover:bg-white/10 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono px-1">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(200, z + 25))}
              className="p-1 rounded hover:bg-white/10 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-white/15" />

          {/* Annotator Tools */}
          <button
            onClick={() => setActiveTool('highlight')}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              activeTool === 'highlight'
                ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                : 'hover:bg-white/10 border-transparent text-white/70'
            }`}
            title="Highlighter"
          >
            <Highlighter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              activeTool === 'pen'
                ? 'bg-blue-500/30 border-blue-400 text-blue-300'
                : 'hover:bg-white/10 border-transparent text-white/70'
            }`}
            title="Pen Annotator"
          >
            <PenTool className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setStatusNotification('Document sent to ICY Print & Scan service.');
              setTimeout(() => setStatusNotification(null), 3500);
            }}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Print Document"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setStatusNotification('Downloading PDF document to ICY workspace...');
              setTimeout(() => setStatusNotification(null), 3500);
            }}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Export PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF View Canvas */}
      <div className="flex-1 bg-[#1a1c2e] p-6 overflow-auto flex justify-center items-start no-scrollbar">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          className="w-full max-w-2xl min-h-[720px] bg-white text-slate-900 rounded-2xl shadow-2xl p-10 flex flex-col justify-between transition-transform"
        >
          <div>
            <div className="border-b pb-4 mb-6 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-slate-900">{documentName.replace('.pdf', '')}</h1>
              <span className="text-xs font-mono text-slate-400">ICY Studio Document</span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              Welcome to <strong>ICY PDF Studio</strong>. This interactive document viewer provides full vector document previewing, page navigation, annotating, highlighting, and print export directly inside ICOS.
            </p>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1 my-6">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Document Metadata</span>
              </div>
              <p>Author: ICOS User · Created: {new Date().toLocaleDateString()} · Pages: {totalPages}</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum.
            </p>
          </div>

          <div className="pt-8 border-t flex justify-between text-[11px] font-mono text-slate-400">
            <span>Page {currentPage} of {totalPages}</span>
            <span>Confidential · ICOS Security Domain</span>
          </div>
        </div>
      </div>
    </div>
  );
};
