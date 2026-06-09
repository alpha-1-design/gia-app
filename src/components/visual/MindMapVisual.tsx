import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

const CHART_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#8b5cf6'];

interface MindMapNode {
  name: string;
  x: number;
  y: number;
  color?: string;
  children?: MindMapNode[];
}

interface MindMapData {
  root?: MindMapNode;
  children?: MindMapNode[];
  nodes?: MindMapNode[];
  title?: string;
}

export const MindMapVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as MindMapData;
  const root = d.root;
  const nodes = d.nodes;
  const title = d.title;
  const [expanded, setExpanded] = useState(true);
  const [copied, copy] = useCopy();
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => {
    if (root) return root;
    return { name: title || 'Root', x: 0, y: 0, children: nodes || [] };
  }, [root, nodes, title]);

  const copyData = useCallback(() => copy(JSON.stringify(tree, null, 2)), [tree, copy]);

  const layout = useMemo(() => {
    const positions: MindMapNode[] = [];
    const depth = (node: MindMapNode, level: number, offset: number): number => {
      const x = level * 180;
      const y = offset;
      positions.push({ name: node.name, x, y, color: node.color, children: node.children });
      if (!node.children?.length) return offset + 60;
      let currentY = offset;
      node.children.forEach((child: MindMapNode) => {
        currentY = depth(child, level + 1, currentY);
      });
      const centerY = (offset + currentY - 60) / 2;
      const existing = positions.find(p => p.x === x && p.y === y);
      if (existing) existing.y = centerY;
      return currentY;
    };
    depth(tree, 0, 50);
    return positions;
  }, [tree]);

  const svgWidth = Math.max(400, (layout.length > 0 ? Math.max(...layout.map(p => p.x)) : 200) + 200);
  const svgHeight = Math.max(300, (layout.length > 0 ? Math.max(...layout.map(p => p.y)) : 200) + 100);

  return (
    <VisualCard title={title || 'Mind Map'} onCopy={copyData} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-1 rounded" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}><ZoomIn size={11} /></button>
        <button onClick={() => setScale(s => Math.max(s - 0.2, 0.3))} className="p-1 rounded" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}><ZoomOut size={11} /></button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="p-1 rounded" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}><RotateCcw size={11} /></button>
        <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{Math.round(scale * 100)}%</span>
      </div>
      <div ref={svgRef} className="overflow-auto rounded-lg" style={{ background: '#0d0d14', maxHeight: expanded ? '600px' : '250px', cursor: 'grab' }}>
        <svg width={svgWidth * scale} height={svgHeight * scale} style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <g transform={`scale(${scale})`}>
            {layout.map((node, i) => {
              const color = node.color || CHART_COLORS[i % CHART_COLORS.length];
              return (
                <g key={i}>
                  {node.children?.map((child: MindMapNode, ci: number) => {
                    const childPos = layout.find(p => p.name === child.name);
                    if (!childPos) return null;
                    const childColor = child.color || CHART_COLORS[(i + ci + 1) % CHART_COLORS.length];
                    return (
                      <line key={`l-${i}-${ci}`} x1={node.x + 60} y1={node.y} x2={childPos.x} y2={childPos.y} stroke={childColor} strokeWidth="1.5" opacity="0.4" />
                    );
                  })}
                  <circle cx={node.x} cy={node.y} r="24" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
                  <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize="10" fontWeight="600">
                    {node.name.length > 12 ? node.name.slice(0, 11) + '\u2026' : node.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </VisualCard>
  );
};
