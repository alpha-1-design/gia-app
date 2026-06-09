import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Type, Scan, Tag, Clock, Eye, Loader2 } from 'lucide-react';
import type { ComprehensiveVisionAnalysis } from '../services/VisionService';

interface Props {
  analysis: ComprehensiveVisionAnalysis | null;
  loading: boolean;
  imageData?: string;
  onRetry?: () => void;
}

const OBJECT_COLORS = [
  '#a855f7', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#ef4444', '#06b6d4',
];

export const VisionAnalysisPanel: React.FC<Props> = ({ analysis, loading, imageData, onRetry }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showObjects, setShowObjects] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analysis?.objects?.objects.length || !imageData) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!img) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!showObjects) return;

    analysis.objects.objects.forEach((obj, i) => {
      const color = OBJECT_COLORS[i % OBJECT_COLORS.length];
      const { xmin, ymin, xmax, ymax } = obj.box;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
      ctx.setLineDash([]);

      const label = `${obj.label} ${Math.round(obj.score * 100)}%`;
      ctx.fillStyle = color;
      const fontSize = Math.max(10, w * 0.016);
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.fillRect(xmin, ymin - fontSize - 4, tw + 6, fontSize + 4);
      ctx.fillStyle = '#000';
      ctx.fillText(label, xmin + 3, ymin - 3);
    });
  }, [analysis, showObjects, imageData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Eye size={24} className="text-violet-400" />
        </motion.div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <Loader2 size={12} className="text-amber-400 animate-spin" />
            <span className="text-xs font-medium text-zinc-300">GIA is analyzing this image...</span>
          </div>
          <span className="text-[10px] text-zinc-500">Running caption, OCR, object detection & classification</span>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const hasOcr = analysis.ocr?.text && analysis.ocr.text.length > 0;
  const hasObjects = analysis.objects && analysis.objects.objects.length > 0;
  const hasCaption = analysis.caption?.description && analysis.caption.description.length > 0;
  const hasClass = analysis.classification?.label && analysis.classification.score > 0;
  const hasAny = hasOcr || hasObjects || hasCaption || hasClass;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-[10px] text-zinc-500">No vision data extracted</p>
        {onRetry && (
          <button onClick={onRetry} className="text-[10px] text-violet-400 hover:text-violet-300">
            Retry analysis
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Object detection overlay canvas */}
      {imageData && hasObjects && (
        <div className="relative rounded-xl overflow-hidden">
          <img ref={imgRef} src={imageData} alt="Analysis" className="w-full rounded-xl" crossOrigin="anonymous" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </div>
      )}

      {/* Caption */}
      {hasCaption && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <Sparkles size={13} className="text-violet-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider mb-0.5">Caption</p>
            <p className="text-xs text-zinc-300">{analysis.caption!.description}</p>
          </div>
        </div>
      )}

      {/* OCR */}
      {hasOcr && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <Type size={13} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider mb-0.5">Text Found</p>
            <p className="text-xs text-zinc-300 break-all">{analysis.ocr!.text}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {/* Objects */}
        {hasObjects && (
          <div className="flex-1 flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <Scan size={13} className="text-blue-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-0.5">Objects</p>
              <div className="flex flex-wrap gap-1">
                {analysis.objects!.objects.slice(0, 6).map((obj, i) => (
                  <span
                    key={i}
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: `${OBJECT_COLORS[i % OBJECT_COLORS.length]}20`, color: OBJECT_COLORS[i % OBJECT_COLORS.length] }}
                  >
                    {obj.label}
                  </span>
                ))}
                {analysis.objects!.objects.length > 6 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full text-zinc-500">
                    +{analysis.objects!.objects.length - 6}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowObjects(!showObjects)}
                className="text-[9px] mt-1 text-zinc-500 hover:text-zinc-300"
              >
                {showObjects ? 'Hide boxes' : 'Show boxes'}
              </button>
            </div>
          </div>
        )}

        {/* Classification */}
        {hasClass && (
          <div className="flex-1 flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <Tag size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-0.5">Category</p>
              <p className="text-xs text-zinc-300 capitalize">{analysis.classification!.label.replace(/,/g, ', ')}</p>
              <p className="text-[9px] text-zinc-500">{Math.round(analysis.classification!.score * 100)}% confidence</p>
            </div>
          </div>
        )}
      </div>

      {/* Timing */}
      <div className="flex items-center gap-3 px-2.5 py-1.5">
        <Clock size={10} className="text-zinc-600" />
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {analysis.caption && <span className="text-[9px] text-zinc-600">Caption: {analysis.caption.timeMs}ms</span>}
          {analysis.ocr && <span className="text-[9px] text-zinc-600">OCR: {analysis.ocr.timeMs}ms</span>}
          {analysis.objects && <span className="text-[9px] text-zinc-600">Objects: {analysis.objects.timeMs}ms</span>}
          {analysis.classification && <span className="text-[9px] text-zinc-600">Classify: {analysis.classification.timeMs}ms</span>}
          <span className="text-[9px] text-zinc-500 font-medium">Total: {analysis.totalTimeMs}ms</span>
        </div>
      </div>
    </div>
  );
};
