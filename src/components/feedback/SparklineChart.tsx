import React, { useRef, useEffect, useMemo } from 'react';

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showMinMax?: boolean;
}

const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  width = 120,
  height = 32,
  color = '#818cf8',
  showMinMax = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { min, max, normalized } = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 0, normalized: [] as number[] };
    const mn = Math.min(...data);
    const mx = Math.max(...data);
    const range = mx - mn || 1;
    return {
      min: mn,
      max: mx,
      normalized: data.map((v) => (v - mn) / range),
    };
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || normalized.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Draw fill
    ctx.beginPath();
    normalized.forEach((v, i) => {
      const x = (i / (normalized.length - 1)) * width;
      const y = height - v * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}50`);
    gradient.addColorStop(1, `${color}10`);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    normalized.forEach((v, i) => {
      const x = (i / (normalized.length - 1)) * width;
      const y = height - v * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Min/Max dots
    if (showMinMax && normalized.length > 0) {
      const minIdx = data.indexOf(min);
      const maxIdx = data.indexOf(max);

      if (minIdx >= 0) {
        const x = (minIdx / (normalized.length - 1)) * width;
        const y = height - normalized[minIdx] * (height - 4) - 2;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f87171';
        ctx.fill();
      }

      if (maxIdx >= 0 && maxIdx !== minIdx) {
        const x = (maxIdx / (normalized.length - 1)) * width;
        const y = height - normalized[maxIdx] * (height - 4) - 2;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#34d399';
        ctx.fill();
      }
    }
  }, [data, width, height, color, showMinMax, normalized, min, max]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-zinc-600 text-[10px] bg-zinc-900 rounded"
        style={{ width, height }}
      >
        no data
      </div>
    );
  }

  return (
    <div className="relative inline-flex flex-col">
      <canvas ref={canvasRef} style={{ width, height }} className="rounded" />
      {showMinMax && (
        <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
};

export default SparklineChart;
