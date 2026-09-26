import React, { useState, useMemo, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ChevronDown, Maximize2 } from 'lucide-react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

const CHART_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#8b5cf6'];

interface MindMapNode {
  name: string;
  color?: string;
  children?: MindMapNode[];
}

interface MindMapData {
  root?: MindMapNode;
  children?: MindMapNode[];
  nodes?: MindMapNode[];
  title?: string;
}

/** Laid-out node: absolute canvas coords plus the id of its parent. */
interface LaidOut {
  id: string;
  name: string;
  color?: string;
  x: number;
  y: number;
  parentId: string | null;
}

const NODE_W = 132;
const NODE_H = 34;
const GAP_X = 64;
const GAP_Y = 14;
const PADDING = 24;

/**
 * Longest label rendered before ellipsizing. SVG text has no automatic
 * wrapping, so long names must be cut. Kept generous (was 12, which mangled
 * almost every real label) and paired with a native tooltip via <title> so the
 * full name is still reachable on hover/long-press.
 */
const MAX_LABEL = 30;

function truncate(s: string, max = MAX_LABEL): string {
  return s.length > max ? `${s.slice(0, max - 1)}\u2026` : s;
}

export const MindMapVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as MindMapData;
  const title = d.title;
  const [expanded, setExpanded] = useState(true);
  const [copied, copy] = useCopy();
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [userAdjusted, setUserAdjusted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const tree = useMemo<MindMapNode>(() => {
    if (d.root) return d.root;
    return { name: title || 'Root', children: d.nodes || d.children || [] };
  }, [d.root, d.nodes, d.children, title]);

  /**
   * Layout by tree depth (columns) and leaf order (rows), then centre every
   * parent on its children. Every node gets a stable id, because the old code
   * matched children to positions by NAME — so any repeated label ("Open …"
   * twice) silently wired the connector lines to the wrong node.
   */
  const { nodes, contentWidth, contentHeight } = useMemo(() => {
    const out: LaidOut[] = [];
    let counter = 0;
    let cursorY = 0;

    const walk = (node: MindMapNode, depth: number, parentId: string | null): { top: number; bottom: number } => {
      const id = `n${counter++}`;
      const entry: LaidOut = { id, name: node.name, color: node.color, x: PADDING + depth * (NODE_W + GAP_X), y: 0, parentId };
      const kids = node.children || [];

      if (kids.length === 0) {
        entry.y = cursorY;
        cursorY += NODE_H + GAP_Y;
        out.push(entry);
        return { top: entry.y, bottom: entry.y + NODE_H };
      }

      // Reserve this node's row before descending, so children can be centred on it.
      entry.y = cursorY;
      cursorY += NODE_H + GAP_Y;
      out.push(entry);

      const bounds = kids.map(kid => walk(kid, depth + 1, id));
      const top = Math.min(...bounds.map(b => b.top));
      const bottom = Math.max(...bounds.map(b => b.bottom));
      entry.y = (top + bottom) / 2 - NODE_H / 2;
      return { top: entry.y, bottom: entry.y + NODE_H };
    };

    walk(tree, 0, null);

    // Guarantee the root is fully on-canvas. The previous layout placed the
    // root at x=0, so the left half of the root circle and its label were
    // clipped by the container on every render.
    const w = Math.max(...out.map(n => n.x + NODE_W)) + PADDING;
    const h = Math.max(...out.map(n => n.y + NODE_H)) + PADDING;
    return { nodes: out, contentWidth: w, contentHeight: h };
  }, [tree]);

  const copyData = useCallback(() => copy(JSON.stringify(tree, null, 2)), [tree, copy]);

  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  /**
   * Fit the map to the available width on first paint, so the user sees the
   * WHOLE graph instead of a zoomed-in corner with no way to reach the rest.
   * Runs until the user zooms or pans, after which their choice is respected.
   */
  useLayoutEffect(() => {
    if (userAdjusted) return;
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const fit = el.clientWidth / contentWidth;
    setScale(Math.max(0.25, Math.min(1, fit)));
    setPan({ x: 0, y: 0 });
  }, [contentWidth, userAdjusted]);

  // Reset the view when the underlying data changes to a different graph.
  useEffect(() => {
    setUserAdjusted(false);
    setPan({ x: 0, y: 0 });
  }, [contentWidth, contentHeight]);

  const zoom = (next: number) => {
    setUserAdjusted(true);
    setScale(Math.max(0.2, Math.min(2.5, next)));
  };

  const reset = () => {
    setUserAdjusted(false);
    setScale(1);
    setPan({ x: 0, y: 0 });
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
  };

  // Real drag-to-pan. Previously `cursor: grab` was set but no handler was
  // ever attached, so the grab cursor promised an interaction that did nothing.
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d0 = dragging.current;
    if (!d0) return;
    setPan({ x: d0.panX + (e.clientX - d0.x), y: d0.panY + (e.clientY - d0.y) });
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = null;
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const collapsed = !expanded;

  return (
    <VisualCard
      title={title || 'Mind Map'}
      onCopy={copyData}
      copied={copied}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {collapsed ? (
        // Collapsed = a real minimize: one tappable summary row, none of the
        // canvas height. Previously "collapse" still rendered a 250px-tall
        // empty box, so there was effectively no way to shrink the card.
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center gap-2 text-left"
          aria-label="Expand mind map"
        >
          <span
            className="text-[11px] truncate"
            style={{ color: 'var(--gia-muted)' }}
          >
            {nodes.length} nodes &middot; {truncate(tree.name, 32)}
          </span>
          <Maximize2 size={12} className="ml-auto shrink-0" style={{ color: 'var(--gia-muted-2)' }} />
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button onClick={() => zoom(scale + 0.2)} className="p-1.5 rounded-lg" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }} aria-label="Zoom in">
              <ZoomIn size={11} />
            </button>
            <button onClick={() => zoom(scale - 0.2)} className="p-1.5 rounded-lg" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }} aria-label="Zoom out">
              <ZoomOut size={11} />
            </button>
            <button onClick={reset} className="p-1.5 rounded-lg" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }} aria-label="Reset view">
              <RotateCcw size={11} />
            </button>
            <span className="text-[9px] tabular-nums" style={{ color: 'var(--gia-muted-2)' }}>{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setExpanded(false)}
              className="ml-auto p-1.5 rounded-lg flex items-center gap-1"
              style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}
              aria-label="Collapse mind map"
            >
              <ChevronDown size={11} />
            </button>
          </div>

          {/* Scrollable in BOTH axes, with an explicit capped height. The map is
              wider than a phone screen by construction, so horizontal scrolling
              is the only way to reach the right-hand branches. */}
          <div
            ref={scrollRef}
            className="overflow-auto rounded-lg overscroll-contain"
            style={{
              background: 'var(--gia-surface-2)',
              maxHeight: 'min(60vh, 420px)',
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'pan-x pan-y',
              WebkitOverflowScrolling: 'touch',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <svg
              width={contentWidth * scale}
              height={contentHeight * scale}
              viewBox={`0 0 ${contentWidth} ${contentHeight}`}
              style={{ display: 'block', maxWidth: 'none' }}
            >
              <g transform={`scale(${scale})`}>
                {nodes.map((node, i) => {
                  const color = node.color || CHART_COLORS[i % CHART_COLORS.length];
                  const parent = node.parentId ? byId.get(node.parentId) : null;
                  return (
                    <g key={node.id}>
                      {parent && (
                        <line
                          x1={parent.x + NODE_W}
                          y1={parent.y + NODE_H / 2}
                          x2={node.x}
                          y2={node.y + NODE_H / 2}
                          stroke={color}
                          strokeWidth="1.5"
                          opacity="0.45"
                        />
                      )}
                      <rect
                        x={node.x}
                        y={node.y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={NODE_H / 2}
                        fill={color}
                        fillOpacity="0.14"
                        stroke={color}
                        strokeWidth="1.5"
                      />
                      <text
                        x={node.x + NODE_W / 2}
                        y={node.y + NODE_H / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={color}
                        fontSize="11"
                        fontWeight="600"
                      >
                        {truncate(node.name)}
                        {/* Full label for hover/long-press, since the visible
                            text is ellipsized. */}
                        <title>{node.name}</title>
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <p className="text-[9px] mt-1.5" style={{ color: 'var(--gia-muted-2)' }}>
            Drag to pan, scroll to reach every branch.
          </p>
        </>
      )}
    </VisualCard>
  );
};
