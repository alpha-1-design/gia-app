import React, { useCallback } from 'react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

interface CanvasElement {
  type: 'rect' | 'circle' | 'ellipse' | 'line' | 'text' | 'path' | 'polygon';
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  size?: number;
  color?: string;
  fill?: string;
  width?: number;
  opacity?: number;
  d?: string;
  points?: string;
}

interface CanvasData {
  width?: number;
  height?: number;
  elements: CanvasElement[];
  title?: string;
  background?: string;
}

function renderElement(el: CanvasElement, i: number): React.ReactNode {
  const stroke = el.color || '#3b82f6';
  const fill = el.fill || 'none';
  const strokeWidth = el.width ?? 2;
  const opacity = el.opacity ?? 1;
  const key = `el-${i}`;

  switch (el.type) {
    case 'rect':
      return <rect key={key} x={el.x ?? 0} y={el.y ?? 0} width={el.w ?? 50} height={el.h ?? 50} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} rx={el.rx} ry={el.ry} />;
    case 'circle':
      return <circle key={key} cx={el.cx ?? 50} cy={el.cy ?? 50} r={el.r ?? 30} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
    case 'ellipse':
      return <ellipse key={key} cx={el.cx ?? 50} cy={el.cy ?? 50} rx={el.rx ?? 40} ry={el.ry ?? 25} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
    case 'line':
      return <line key={key} x1={el.x1 ?? 0} y1={el.y1 ?? 0} x2={el.x2 ?? 100} y2={el.y2 ?? 100} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
    case 'text':
      return (
        <text key={key} x={el.x ?? 0} y={el.y ?? 20} fill={stroke} fontSize={el.size ?? 16} fontWeight="500" opacity={opacity}>
          {el.text || ''}
        </text>
      );
    case 'path':
      return <path key={key} d={el.d || ''} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
    case 'polygon':
      return <polygon key={key} points={el.points || ''} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
    default:
      return null;
  }
}

export const CanvasVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as unknown as CanvasData;
  const elements = d.elements || [];
  const title = d.title;
  const [copied, copy] = useCopy();

  const copyData = useCallback(() => copy(JSON.stringify(d, null, 2)), [d, copy]);

  const svgWidth = d.width ?? 600;
  const svgHeight = d.height ?? 400;

  if (!elements.length) return <div className="p-4 text-[11px]" style={{ color: 'var(--gia-muted-2)' }}>No canvas elements</div>;

  return (
    <VisualCard title={title || 'Canvas'} onCopy={copyData} copied={copied}>
      <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--gia-border)', background: d.background || '#0d0d14' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          style={{ maxHeight: '500px', minHeight: '200px' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {elements.map((el, i) => renderElement(el, i))}
        </svg>
      </div>
    </VisualCard>
  );
};
