/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ICOS Drawing & Creative Sketch Studio
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  PenTool, 
  Eraser, 
  Download, 
  RotateCcw, 
  Trash2, 
  X, 
  Palette, 
  Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DrawingCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const DrawingCanvasModal: React.FC<DrawingCanvasModalProps> = ({
  isOpen,
  onClose,
  title = 'ICOS Creative Drawing Studio',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'pen' | 'glow' | 'eraser'>('glow');
  const [color, setColor] = useState('#00f2fe');
  const [brushSize, setBrushSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const historyRef = useRef<ImageData[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;

    ctx.fillStyle = '#090b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [isOpen]);

  if (!isOpen) return null;

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (historyRef.current.length > 20) historyRef.current.shift();
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || historyRef.current.length === 0) return;

    const previous = historyRef.current.pop();
    if (previous) ctx.putImageData(previous, 0, 0);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    saveHistory();
    ctx.fillStyle = '#090b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `icyos-drawing-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * window.devicePixelRatio,
      y: (clientY - rect.top) * window.devicePixelRatio,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    saveHistory();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);

    ctx.lineWidth = brushSize * window.devicePixelRatio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.strokeStyle = '#090b14';
      ctx.shadowBlur = 0;
    } else if (tool === 'glow') {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = brushSize * 3;
    } else {
      ctx.strokeStyle = color;
      ctx.shadowBlur = 0;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    setIsDrawing(false);
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
          className="w-full max-w-4xl h-[82vh] bg-[#0c0e1a]/95 border border-cyan-500/30 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-3xl text-left flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-14 px-5 border-b border-white/10 bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-purple-950/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                <PenTool className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-wide">{title}</span>
                <span className="text-[10px] text-cyan-300 font-mono">Pressure-Adaptive Canvas Studio</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                title="Export Image"
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

          {/* Tools & Palette Bar */}
          <div className="px-5 py-2 border-b border-white/5 bg-black/30 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0">
            {/* Tool Selection */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTool('glow')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'glow' ? 'bg-cyan-600 text-white shadow' : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Neon Glow</span>
              </button>
              <button
                onClick={() => setTool('pen')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'pen' ? 'bg-cyan-600 text-white shadow' : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Pen</span>
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'eraser' ? 'bg-rose-600 text-white shadow' : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Eraser</span>
              </button>
            </div>

            {/* Color Palette */}
            <div className="flex items-center gap-2">
              {['#00f2fe', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ffffff', '#38bdf8'].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    if (tool === 'eraser') setTool('glow');
                  }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                    color === c && tool !== 'eraser' ? 'scale-125 border-white shadow-glow' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Brush Size & Undo/Clear */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <span className="font-mono text-[10px]">SIZE:</span>
                <input
                  type="range"
                  min="2"
                  max="24"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-20 accent-cyan-400 cursor-pointer"
                />
              </div>

              <button
                onClick={handleUndo}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white cursor-pointer"
                title="Undo Stroke"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleClear}
                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer"
                title="Clear Canvas"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative bg-[#090b14] overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
              className="w-full h-full block cursor-crosshair touch-none"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
