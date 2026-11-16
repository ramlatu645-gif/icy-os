/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ICOS 3D Spatial Modeler & Geometry Studio
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  RotateCw, 
  Maximize2, 
  X, 
  Sun, 
  Layers, 
  Sparkles, 
  Sliders, 
  Download,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Spatial3DModelerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialShape?: 'torus' | 'crystal' | 'sphere' | 'cube' | 'wave';
  modelTitle?: string;
}

export const Spatial3DModelerModal: React.FC<Spatial3DModelerModalProps> = ({
  isOpen,
  onClose,
  initialShape = 'torus',
  modelTitle = 'ICOS 3D Spatial Modeler',
}) => {
  const [shape, setShape] = useState<'torus' | 'crystal' | 'sphere' | 'cube' | 'wave'>(initialShape);
  const [renderMode, setRenderMode] = useState<'solid' | 'wireframe' | 'points'>('solid');
  const [colorScheme, setColorScheme] = useState<'cyan' | 'purple' | 'emerald' | 'amber'>('cyan');
  const [isRotating, setIsRotating] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Rotation angles
  const angleRef = useRef({ x: 0.3, y: 0.4, z: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.clientWidth * window.devicePixelRatio);
    let height = (canvas.height = canvas.clientHeight * window.devicePixelRatio);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
      height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
    };
    window.addEventListener('resize', handleResize);

    // Generate 3D Vertices based on shape
    const generateGeometry = () => {
      const vertices: { x: number; y: number; z: number }[] = [];
      const edges: [number, number][] = [];

      if (shape === 'torus') {
        const R = 1.3;
        const r = 0.5;
        const pSegments = 30;
        const qSegments = 16;
        for (let i = 0; i < pSegments; i++) {
          const u = (i * 2 * Math.PI) / pSegments;
          for (let j = 0; j < qSegments; j++) {
            const v = (j * 2 * Math.PI) / qSegments;
            const x = (R + r * Math.cos(v)) * Math.cos(u);
            const y = (R + r * Math.cos(v)) * Math.sin(u);
            const z = r * Math.sin(v);
            vertices.push({ x, y, z });

            const current = i * qSegments + j;
            const nextU = ((i + 1) % pSegments) * qSegments + j;
            const nextV = i * qSegments + ((j + 1) % qSegments);
            edges.push([current, nextU]);
            edges.push([current, nextV]);
          }
        }
      } else if (shape === 'crystal') {
        // Octahedral dual crystal
        const s = 1.5;
        vertices.push(
          { x: 0, y: s * 1.4, z: 0 },
          { x: 0, y: -s * 1.4, z: 0 },
          { x: s, y: 0, z: s },
          { x: -s, y: 0, z: s },
          { x: -s, y: 0, z: -s },
          { x: s, y: 0, z: -s }
        );
        for (let i = 2; i <= 5; i++) {
          const next = i === 5 ? 2 : i + 1;
          edges.push([0, i], [1, i], [i, next]);
        }
      } else if (shape === 'cube') {
        const s = 1.2;
        for (let x of [-s, s]) {
          for (let y of [-s, s]) {
            for (let z of [-s, s]) {
              vertices.push({ x, y, z });
            }
          }
        }
        edges.push(
          [0, 1], [1, 3], [3, 2], [2, 0],
          [4, 5], [5, 7], [7, 6], [6, 4],
          [0, 4], [1, 5], [2, 6], [3, 7]
        );
      } else if (shape === 'sphere') {
        const rings = 12;
        const sectors = 18;
        const rad = 1.4;
        for (let i = 0; i <= rings; i++) {
          const phi = (i * Math.PI) / rings;
          for (let j = 0; j < sectors; j++) {
            const theta = (j * 2 * Math.PI) / sectors;
            vertices.push({
              x: rad * Math.sin(phi) * Math.cos(theta),
              y: rad * Math.cos(phi),
              z: rad * Math.sin(phi) * Math.sin(theta)
            });
            const curr = i * sectors + j;
            const nextS = i * sectors + ((j + 1) % sectors);
            edges.push([curr, nextS]);
            if (i > 0) {
              const prevR = (i - 1) * sectors + j;
              edges.push([curr, prevR]);
            }
          }
        }
      } else {
        // Wave Grid
        const grid = 9;
        const span = 2.4;
        for (let i = 0; i < grid; i++) {
          for (let j = 0; j < grid; j++) {
            const x = (i / (grid - 1) - 0.5) * span;
            const z = (j / (grid - 1) - 0.5) * span;
            const y = Math.sin(Math.sqrt(x * x + z * z) * 4) * 0.4;
            vertices.push({ x, y, z });
            const curr = i * grid + j;
            if (i < grid - 1) edges.push([curr, curr + grid]);
            if (j < grid - 1) edges.push([curr, curr + 1]);
          }
        }
      }

      return { vertices, edges };
    };

    let geom = generateGeometry();

    const getColors = () => {
      switch (colorScheme) {
        case 'purple':
          return { primary: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', bg: '#0b0816' };
        case 'emerald':
          return { primary: '#34d399', glow: 'rgba(52, 211, 153, 0.4)', bg: '#06130d' };
        case 'amber':
          return { primary: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', bg: '#140f06' };
        case 'cyan':
        default:
          return { primary: '#22d3ee', glow: 'rgba(34, 211, 238, 0.45)', bg: '#060d16' };
      }
    };

    // Render loop
    const render = () => {
      if (isRotating) {
        angleRef.current.y += 0.015 * rotationSpeed;
        angleRef.current.x += 0.008 * rotationSpeed;
      }

      const colors = getColors();
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);

      // Draw subtle background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const step = 40 * window.devicePixelRatio;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const scale = Math.min(width, height) * 0.28;
      const fov = 4.0;
      const cosX = Math.cos(angleRef.current.x);
      const sinX = Math.sin(angleRef.current.x);
      const cosY = Math.cos(angleRef.current.y);
      const sinY = Math.sin(angleRef.current.y);

      // Project vertices
      const projected = geom.vertices.map((v) => {
        // Rotate Y
        let x1 = v.x * cosY + v.z * sinY;
        let y1 = v.y;
        let z1 = -v.x * sinY + v.z * cosY;

        // Rotate X
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX + 3.2;

        const p = fov / Math.max(0.1, z2);
        return {
          x: width / 2 + x2 * p * scale,
          y: height / 2 + y2 * p * scale,
          z: z2,
        };
      });

      // Draw Edges / Wireframe
      if (renderMode === 'solid' || renderMode === 'wireframe') {
        ctx.lineWidth = renderMode === 'solid' ? 1.5 : 2;
        ctx.strokeStyle = colors.primary;
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = renderMode === 'solid' ? 12 : 18;

        for (const [i, j] of geom.edges) {
          const p1 = projected[i];
          const p2 = projected[j];
          if (!p1 || !p2) continue;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // Draw Vertices / Points
      if (renderMode === 'points' || renderMode === 'solid') {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 10;
        for (const p of projected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, renderMode === 'points' ? 3.5 : 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen, shape, renderMode, colorScheme, isRotating, rotationSpeed]);

  if (!isOpen) return null;

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
                <Box className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-wide">{modelTitle}</span>
                <span className="text-[10px] text-cyan-300 font-mono">Procedural Spatial 3D Engine</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRotating(!isRotating)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isRotating ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-white/50 hover:text-white'
                }`}
                title="Toggle Auto Orbit"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Controls Bar */}
          <div className="px-5 py-2.5 border-b border-white/5 bg-black/30 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0">
            {/* Shape Selectors */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-white/40 mr-1">SHAPE:</span>
              {(['torus', 'crystal', 'sphere', 'cube', 'wave'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setShape(s)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                    shape === s ? 'bg-cyan-600 text-white shadow-md' : 'bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Shading Mode */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-white/40 mr-1">MODE:</span>
              {(['solid', 'wireframe', 'points'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setRenderMode(m)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                    renderMode === m ? 'bg-purple-600 text-white shadow-md' : 'bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Palette */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-white/40 mr-1">GLOW:</span>
              {(['cyan', 'purple', 'emerald', 'amber'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setColorScheme(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                    colorScheme === c ? 'scale-125 border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor:
                      c === 'cyan' ? '#00f2fe' : c === 'purple' ? '#c084fc' : c === 'emerald' ? '#34d399' : '#fbbf24',
                  }}
                />
              ))}
            </div>
          </div>

          {/* 3D Viewport Canvas */}
          <div 
            className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden"
            onMouseDown={(e) => {
              isDraggingRef.current = true;
              lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }}
            onMouseMove={(e) => {
              if (!isDraggingRef.current) return;
              const dx = e.clientX - lastMousePosRef.current.x;
              const dy = e.clientY - lastMousePosRef.current.y;
              angleRef.current.y += dx * 0.01;
              angleRef.current.x += dy * 0.01;
              lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }}
            onMouseUp={() => (isDraggingRef.current = false)}
            onMouseLeave={() => (isDraggingRef.current = false)}
          >
            <canvas ref={canvasRef} className="w-full h-full block" />

            <div className="absolute bottom-4 left-4 pointer-events-none text-[11px] font-mono text-white/40 space-y-0.5">
              <div>Drag to orbit rotate 3D canvas</div>
              <div>Geometry: {shape.toUpperCase()} · Mode: {renderMode.toUpperCase()}</div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
