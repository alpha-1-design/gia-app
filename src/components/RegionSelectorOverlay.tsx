import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Scan, Sparkles } from 'lucide-react';
import { VisionAnalysisPanel } from './VisionAnalysisPanel';
import type { ComprehensiveVisionAnalysis } from '../services/VisionService';

interface Point { x: number; y: number }

interface RegionSelectorOverlayProps {
  imageSrc: string;
  onSelect: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

// --- Edge detection with NMS + adaptive threshold ---
function buildEdgeMap(img: HTMLImageElement, downsample = 4) {
  const sw = Math.floor(img.naturalWidth / downsample);
  const sh = Math.floor(img.naturalHeight / downsample);

  const canvas = document.createElement('canvas');
  canvas.width = sw; canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;
  canvas.remove();

  // Grayscale
  const gray = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }

  // Sobel kernels + store gradients for direction
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const mag = new Float32Array(sw * sh);
  const grad = new Float32Array(sw * sh);

  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      let gx = 0, gy = 0;
      for (let wy = -1; wy <= 1; wy++) {
        for (let wx = -1; wx <= 1; wx++) {
          const idx = (y + wy) * sw + (x + wx);
          const ki = (wy + 1) * 3 + (wx + 1);
          gx += gray[idx] * kx[ki];
          gy += gray[idx] * ky[ki];
        }
      }
      mag[y * sw + x] = Math.sqrt(gx * gx + gy * gy);
      // Encode angle as int: atan2 in [-π,π] mapped to [-31416, 31416]
      const angle = Math.atan2(gy, gx);
      grad[y * sw + x] = angle;
    }
  }

  // Non-maximum suppression with direction binning
  const dir = new Float32Array(sw * sh);

  const nms = new Float32Array(sw * sh);
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const idx = y * sw + x;
      const a = (grad[idx] * 180 / Math.PI + 360) % 180;

      let n1 = 0, n2 = 0;
      let sector = 0;
      if (a < 22.5 || a >= 157.5) {
        n1 = mag[y * sw + (x - 1)];
        n2 = mag[y * sw + (x + 1)];
        sector = 1;
      } else if (a < 67.5) {
        n1 = mag[(y - 1) * sw + (x + 1)];
        n2 = mag[(y + 1) * sw + (x - 1)];
        sector = 2;
      } else if (a < 112.5) {
        n1 = mag[(y - 1) * sw + x];
        n2 = mag[(y + 1) * sw + x];
        sector = 3;
      } else {
        n1 = mag[(y - 1) * sw + (x - 1)];
        n2 = mag[(y + 1) * sw + (x + 1)];
        sector = 4;
      }

      if (mag[idx] >= n1 && mag[idx] >= n2) {
        nms[idx] = mag[idx];
        dir[idx] = sector;
      }
    }
  }

  // Adaptive threshold: mean + 0.6 * stddev of non-zero NMS values
  let sum = 0, sumSq = 0, count = 0;
  for (let i = 0; i < sw * sh; i++) {
    if (nms[i] > 0) {
      sum += nms[i];
      sumSq += nms[i] * nms[i];
      count++;
    }
  }
  const mean = count > 0 ? sum / count : 0;
  const std = count > 0 ? Math.sqrt(Math.max(0, sumSq / count - mean * mean)) : 0;
  const threshold = Math.max(25, mean + std * 0.6);

  const result = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    result[i] = nms[i] > threshold ? nms[i] : 0;
  }

  return { map: result, dir, w: sw, h: sh, threshold };
}

// --- Chaikin path smoothing ---
function smoothPath(points: Point[], iters = 2): Point[] {
  if (points.length < 3) return points;
  let pts = points;
  for (let iter = 0; iter < iters; iter++) {
    const next: Point[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    pts = next;
  }
  return pts;
}

function subsample(points: Point[], step: number): Point[] {
  const r: Point[] = [];
  for (let i = 0; i < points.length; i += step) r.push(points[i]);
  const last = points[points.length - 1];
  if (r.length && r[r.length - 1] !== last) r.push(last);
  return r;
}

// --- Snap path to nearest strong edges (gradient-weighted) ---
function snapToEdges(
  path: Point[], edgeMap: Float32Array, dir: Float32Array, ew: number, eh: number,
  sx: number, sy: number, radius: number,
): Point[] {
  if (!path.length) return path;
  const snapped: Point[] = [];
  for (const p of path) {
    const cx = Math.round(p.x * sx);
    const cy = Math.round(p.y * sy);
    let bestScore = Infinity, bx = cx, by = cy;
    for (let r = 1; r <= radius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= ew || ny < 0 || ny >= eh) continue;
          const edgeStr = edgeMap[ny * ew + nx];
          if (edgeStr > 0) {
            const d = Math.sqrt(dx * dx + dy * dy);
            // Score favors close + strong edges: move toward strong edges
            const score = d * d - edgeStr * 0.008;
            if (score < bestScore) { bestScore = score; bx = nx; by = ny; }
          }
        }
      }
    }
    snapped.push({ x: bx / sx, y: by / sy });
  }
  return snapped;
}

// --- Bounding box ---
function bbox(points: Point[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

// --- Milky animated border ---
function drawMilkyBorder(ctx: CanvasRenderingContext2D, path: Point[], animPhase: number) {
  if (path.length < 2) return;
  const layers = [
    { w: 14, a: 0.07, c: '255,255,255' },
    { w: 9, a: 0.13, c: '255,255,255' },
    { w: 6, a: 0.22, c: '220,235,255' },
    { w: 3, a: 0.40, c: '200,225,255' },
    { w: 1.5, a: 0.75, c: '255,255,255' },
  ];
  const phase = animPhase % 1;

  for (const l of layers) {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.closePath();

    const grad = ctx.createLinearGradient(path[0].x, path[0].y, path[path.length - 1].x, path[path.length - 1].y);
    const p0 = phase * 0.25;
    grad.addColorStop(0, `rgba(${l.c},${l.a * (1 - p0)})`);
    grad.addColorStop(Math.min(0.5, 0.2 + phase * 0.4), `rgba(${l.c},${l.a * 1.3})`);
    grad.addColorStop(1, `rgba(${l.c},${l.a * p0})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = l.w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Flowing dash layer
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 5;
  ctx.setLineDash([10, 18]);
  ctx.lineDashOffset = -phase * 50;
  ctx.stroke();
  ctx.setLineDash([]);
}

export const RegionSelectorOverlay: React.FC<RegionSelectorOverlayProps> = ({ imageSrc, onSelect, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pathRef = useRef<Point[]>([]);
  const snappedRef = useRef<Point[]>([]);
  const rafRef = useRef<number>(0);
  const edgeRef = useRef<{ map: Float32Array; dir: Float32Array; w: number; h: number; threshold: number } | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [hasPath, setHasPath] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [animPhase, setAnimPhase] = useState(0);
  const [visionAnalysis, setVisionAnalysis] = useState<ComprehensiveVisionAnalysis | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgW(img.naturalWidth); setImgH(img.naturalHeight); setLoaded(true); };
    img.src = imageSrc;
  }, [imageSrc]);

  // Get display dimensions
  const dims = useMemo(() => {
    if (!loaded || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    const imgAspect = imgW / imgH;
    const conAspect = cw / ch;
    let dw: number, dh: number;
    if (imgAspect > conAspect) { dw = cw; dh = cw / imgAspect; }
    else { dh = ch; dw = ch * imgAspect; }
    return { cw, ch, dw, dh, ox: (cw - dw) / 2, oy: (ch - dh) / 2, sx: imgW / dw, sy: imgH / dh };
  }, [loaded, imgW, imgH]);

  // Build edge map once image loads
  useEffect(() => {
    if (!loaded || !imgRef.current) return;
    edgeRef.current = buildEdgeMap(imgRef.current, 4);
  }, [loaded]);

  // Animation loop for milky border
  useEffect(() => {
    if (!hasPath || snapping) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      setAnimPhase(p => p + 0.008);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [hasPath, snapping]);

  // Redraw canvas
  const redraw = useCallback((path: Point[], snapped: Point[], phase: number) => {
    const canvas = displayRef.current;
    const d = dims;
    if (!canvas || !imgRef.current || !d) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = d.cw * dpr;
    canvas.height = d.ch * dpr;
    canvas.style.width = `${d.cw}px`;
    canvas.style.height = `${d.ch}px`;
    ctx.scale(dpr, dpr);

    // Dimmed background screenshot
    ctx.filter = 'brightness(0.3) saturate(0.7)';
    ctx.drawImage(imgRef.current, d.ox, d.oy, d.dw, d.dh);
    ctx.filter = 'none';

    if (snapped.length > 2) {
      // Brighten selection interior via clip
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(snapped[0].x, snapped[0].y);
      for (let i = 1; i < snapped.length; i++) ctx.lineTo(snapped[i].x, snapped[i].y);
      ctx.closePath();
      ctx.clip();
      ctx.filter = 'brightness(1.15) contrast(1.05) saturate(1.1)';
      ctx.drawImage(imgRef.current, d.ox, d.oy, d.dw, d.dh);
      ctx.filter = 'none';
      ctx.restore();

      // Milky flowing border
      drawMilkyBorder(ctx, snapped, phase);

      // Subtle interior overlay
      const bb = bbox(snapped);
      const cxx = (bb.x0 + bb.x1) / 2, cyy = (bb.y0 + bb.y1) / 2;
      const rad = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 0.6;
      const grad = ctx.createRadialGradient(cxx, cyy, 0, cxx, cyy, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.04)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cxx, cyy, rad, 0, Math.PI * 2);
      ctx.fill();
    } else if (path.length > 1) {
      // Show rough path while drawing
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.strokeStyle = 'rgba(168,85,247,0.5)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      const centerX = d.cw / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Draw a circle around anything on screen', centerX, d.ch - 24);
    }
  }, [dims]);

  // Redraw loop
  useEffect(() => {
    if (!dims) return;
    redraw(pathRef.current, snappedRef.current, animPhase);
  }, [dims, loaded, drawing, hasPath, animPhase, redraw]);

  // Snap path to edges on release
  const snapCurrentPath = useCallback(() => {
    const raw = pathRef.current;
    if (raw.length < 8) { pathRef.current = []; return; }

    const edge = edgeRef.current;
    if (!edge) { snappedRef.current = smoothPath(subsample(raw, 2), 3); return; }

    const imSx = edge.w / imgW;
    const imSy = edge.h / imgH;

    const sampled = subsample(raw, 2);
    const smoothed = smoothPath(sampled, 2);
    const snapped = snapToEdges(smoothed, edge.map, edge.dir, edge.w, edge.h, imSx, imSy, 18);
    const final = smoothPath(snapped, 2);

    snappedRef.current = final;
  }, [dims, imgW, imgH]);

  // Touch/mouse handlers
  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDrawing(true);
    setHasPath(false);
    setShowPreview(false);
    setPreviewUrl('');
    pathRef.current = [getPos(e)];
    snappedRef.current = [];
  }, [getPos]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing) return;
    pathRef.current = [...pathRef.current, getPos(e)];
  }, [drawing, getPos]);

  const handleEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing) return;
    setDrawing(false);

    if (pathRef.current.length < 8) {
      pathRef.current = [];
      snappedRef.current = [];
      return;
    }

    setSnapping(true);
    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      snapCurrentPath();
      setHasPath(true);
      setSnapping(false);
    }, 50);
  }, [drawing, snapCurrentPath]);

  const handleReset = useCallback(() => {
    pathRef.current = [];
    snappedRef.current = [];
    setHasPath(false);
    setShowPreview(false);
    setPreviewUrl('');
    setAnimPhase(0);
    setVisionAnalysis(null);
    setVisionLoading(false);
    const d = dims;
    if (d && displayRef.current) {
      const ctx = displayRef.current.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      displayRef.current.width = d.cw * dpr;
      displayRef.current.height = d.ch * dpr;
      displayRef.current.style.width = `${d.cw}px`;
      displayRef.current.style.height = `${d.ch}px`;
      ctx.scale(dpr, dpr);
      ctx.filter = 'brightness(0.3) saturate(0.7)';
      ctx.drawImage(imgRef.current!, d.ox, d.oy, d.dw, d.dh);
      ctx.filter = 'none';
      const centerX = d.cw / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Draw a circle around anything on screen', centerX, d.ch - 24);
    }
  }, [dims]);

  const handleConfirm = useCallback(() => {
    const path = snappedRef.current;
    if (path.length < 3) return;

    const d = dims!;
    const bb = bbox(path);
    const pad = 15;
    const x = Math.max(0, bb.x0 - pad);
    const y = Math.max(0, bb.y0 - pad);
    const w = Math.min(imgW / d.sx, bb.x1 - bb.x0 + pad * 2);
    const h = Math.min(imgH / d.sy, bb.y1 - bb.y0 + pad * 2);

    const crop = document.createElement('canvas');
    crop.width = Math.round(w * d.sx);
    crop.height = Math.round(h * d.sy);
    const cctx = crop.getContext('2d')!;

    // Correct approach: map display coords to image coords
    const displayToImageX = (dx: number) => Math.round((dx - d.ox) * d.sx);
    const displayToImageY = (dy: number) => Math.round((dy - d.oy) * d.sy);
    const ix = Math.max(0, displayToImageX(x));
    const iy = Math.max(0, displayToImageY(y));
    const iw = Math.round(w * d.sx);
    const ih = Math.round(h * d.sy);

    crop.width = Math.min(iw, imgW - ix);
    crop.height = Math.min(ih, imgH - iy);

    // Draw full image cropped
    cctx.drawImage(imgRef.current!, ix, iy, crop.width, crop.height, 0, 0, crop.width, crop.height);

    // Apply path as alpha mask on the border
    const mask = document.createElement('canvas');
    mask.width = crop.width;
    mask.height = crop.height;
    const mctx = mask.getContext('2d')!;

    // Draw white filled path on mask
    mctx.fillStyle = 'white';
    mctx.beginPath();
    const first = snappedRef.current[0];
    mctx.moveTo((first.x - x), (first.y - y));
    for (let i = 1; i < snappedRef.current.length; i++) {
      mctx.lineTo((snappedRef.current[i].x - x), (snappedRef.current[i].y - y));
    }
    mctx.closePath();
    mctx.fill();

    // Feather the mask edges
    mctx.filter = 'blur(2px)';
    mctx.fill();
    mctx.filter = 'none';

    // Apply mask to crop
    const data = cctx.getImageData(0, 0, crop.width, crop.height);
    const maskData = mctx.getImageData(0, 0, crop.width, crop.height);
    for (let i = 0; i < data.data.length / 4; i++) {
      data.data[i * 4 + 3] = maskData.data[i * 4]; // Use mask alpha
    }
    cctx.putImageData(data, 0, 0);

    const resultUrl = crop.toDataURL('image/png', 0.92);
    crop.remove();
    mask.remove();

    setPreviewUrl(resultUrl);
    setShowPreview(true);

    // Run local vision analysis on the selected region
    setVisionLoading(true);
    setVisionAnalysis(null);
    import('../services/VisionService').then(({ default: vs }) => {
      vs.analyze(resultUrl).then(analysis => {
        setVisionAnalysis(analysis);
        setVisionLoading(false);
      }).catch(() => setVisionLoading(false));
    }).catch(() => setVisionLoading(false));
  }, [dims, imgW, imgH]);

  const handleUse = useCallback(() => {
    if (previewUrl) onSelect(previewUrl);
  }, [previewUrl, onSelect]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] flex items-center justify-center select-none"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="relative w-[90vw] h-[80vh] max-w-5xl rounded-3xl overflow-hidden"
        style={{ background: '#050508', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Main interaction area */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        >
          <canvas ref={displayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </div>

        {/* Snapping indicator */}
        <AnimatePresence>
          {snapping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview modal */}
        <AnimatePresence>
          {showPreview && previewUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 150, damping: 16 }}
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ background: 'rgba(0,0,0,0.65)' }}
            >
              <div className="flex flex-col gap-4 max-w-xl w-full px-6">
                <div className="flex gap-4 items-start">
                  <div
                    className="relative rounded-2xl overflow-hidden shadow-2xl shrink-0"
                    style={{ border: '2px solid rgba(255,255,255,0.15)', width: 200, height: 200 }}
                  >
                    <img src={previewUrl} alt="Selection" className="w-full h-full object-cover" />
                    <div
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{
                        boxShadow: 'inset 0 0 30px rgba(168,85,247,0.2), 0 0 20px rgba(168,85,247,0.1)',
                      }}
                    />
                  </div>

                  {/* Vision analysis results */}
                  <div className="flex-1 min-w-0">
                    <VisionAnalysisPanel
                      analysis={visionAnalysis}
                      loading={visionLoading}
                      imageData={previewUrl}
                      onRetry={() => {
                        setVisionLoading(true);
                        setVisionAnalysis(null);
                        import('../services/VisionService').then(({ default: vs }) => {
                          vs.analyze(previewUrl).then(a => { setVisionAnalysis(a); setVisionLoading(false); }).catch(() => setVisionLoading(false));
                        }).catch(() => setVisionLoading(false));
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-center">
                  <button onClick={handleUse} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-semibold transition-all shadow-lg" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: 'white' }}>
                    <Sparkles size={16} /> Search this
                  </button>
                  <button onClick={() => { setShowPreview(false); handleReset(); }} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--gia-text)' }}>
                    <RotateCcw size={14} /> Redraw
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all" style={{ background: 'rgba(255,255,255,0.08)', color: '#f87171' }}>
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            {hasPath && !showPreview && !snapping && (
              <>
                <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--gia-muted)' }}>
                  <RotateCcw size={12} /> Redo
                </button>
                <button onClick={handleConfirm} className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all" style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7' }}>
                  <Scan size={12} /> Isolate
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom hint */}
        {!hasPath && !drawing && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Scan size={14} className="text-violet-400" />
              <span className="text-xs text-zinc-400 font-medium">Draw a circle around anything — GIA will snap to edges</span>
            </div>
          </div>
        )}

        {/* Corner glints */}
        <div className="absolute top-3 left-3 w-10 h-10 pointer-events-none" style={{ borderLeft: '2px solid rgba(168,85,247,0.3)', borderTop: '2px solid rgba(168,85,247,0.3)', borderRadius: '10px 0 0 0' }} />
        <div className="absolute top-3 right-3 w-10 h-10 pointer-events-none" style={{ borderRight: '2px solid rgba(168,85,247,0.3)', borderTop: '2px solid rgba(168,85,247,0.3)', borderRadius: '0 10px 0 0' }} />
        <div className="absolute bottom-3 left-3 w-10 h-10 pointer-events-none" style={{ borderLeft: '2px solid rgba(168,85,247,0.3)', borderBottom: '2px solid rgba(168,85,247,0.3)', borderRadius: '0 0 0 10px' }} />
        <div className="absolute bottom-3 right-3 w-10 h-10 pointer-events-none" style={{ borderRight: '2px solid rgba(168,85,247,0.3)', borderBottom: '2px solid rgba(168,85,247,0.3)', borderRadius: '0 0 10px 0' }} />
      </motion.div>
    </motion.div>
  );
};
