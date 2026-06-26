import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';

interface GraphNode {
  id: string;
  label: string;
  color?: string;
  icon?: string;
  size?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed?: boolean;
  physics?: boolean;
}

interface Position { x: number; y: number; vx: number; vy: number; }
type LayoutMap = Record<string, Position>;

function forceLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number, iterations = 120): LayoutMap {
  const positions: LayoutMap = {};
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  const k = Math.sqrt((width * height) / nodes.length) * 0.8;
  const repulsion = k * k * 1.5;
  const attraction = 0.005;
  const damping = 0.85;
  const velLimit = 8;

  // Initialize positions in a circle
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    positions[node.id] = {
      x: centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
      y: centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
      vx: 0, vy: 0,
    };
  });

  const nodeIds = nodes.map(n => n.id);
  const adj: Record<string, Set<string>> = {};
  for (const id of nodeIds) adj[id] = new Set();
  for (const e of edges) {
    adj[e.source]?.add(e.target);
    adj[e.target]?.add(e.source);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const temperature = 1 - iter / iterations;

    // Repulsion between all pairs
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = positions[nodeIds[i]];
        const b = positions[nodeIds[j]];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx * temperature;
        a.vy -= fy * temperature;
        b.vx += fx * temperature;
        b.vy += fy * temperature;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const a = positions[e.source];
      const b = positions[e.target];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - k) * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx * temperature;
      a.vy += fy * temperature;
      b.vx -= fx * temperature;
      b.vy -= fy * temperature;
    }

    // Center gravity
    for (const id of nodeIds) {
      const p = positions[id];
      p.vx += (centerX - p.x) * 0.001 * temperature;
      p.vy += (centerY - p.y) * 0.001 * temperature;
    }

    // Apply with damping + velocity limit
    for (const id of nodeIds) {
      const p = positions[id];
      p.vx *= damping;
      p.vy *= damping;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > velLimit) { p.vx = (p.vx / speed) * velLimit; p.vy = (p.vy / speed) * velLimit; }
      p.x += p.vx;
      p.y += p.vy;
      p.x = Math.max(20, Math.min(width - 20, p.x));
      p.y = Math.max(20, Math.min(height - 20, p.y));
    }
  }

  return positions;
}

const GraphVisual: React.FC<{ data: GraphData }> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });
  const [dragNode, setDragNode] = useState<string | null>(null);
  const layoutRef = useRef<LayoutMap>({});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.max(300, width), h: Math.max(300, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const positions = useMemo(() => {
    if (!data?.nodes?.length) return {};
    layoutRef.current = forceLayout(data.nodes, data.edges || [], dims.w, dims.h);
    return layoutRef.current;
  }, [data, dims]);

  const handleMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDragNode(nodeId);
  }, []);

  useEffect(() => {
    if (!dragNode) return;
    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = layoutRef.current[dragNode];
      if (p) {
        p.x = e.clientX - rect.left;
        p.y = e.clientY - rect.top;
      }
    };
    const handleUp = () => setDragNode(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragNode]);

  if (!data?.nodes?.length) {
    return <div className="text-gray-500 italic p-4">No graph data</div>;
  }

  const { nodes, edges = [], directed = false } = data;

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px] relative overflow-hidden rounded-lg border border-gray-700/30 bg-gray-900/20">
      <svg width={dims.w} height={dims.h} className="w-full h-full">
        {/* Edge arrowhead marker */}
        {directed && (
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>
        )}

        {/* Edges */}
        {edges.map((edge, i) => {
          const src = positions[edge.source];
          const tgt = positions[edge.target];
          if (!src || !tgt) return null;
          const color = edge.color || '#4a5568';
          const width = edge.width || 1.5;
          const dash = edge.style === 'dashed' ? '6,3' : edge.style === 'dotted' ? '2,2' : 'none';
          const midX = (src.x + tgt.x) / 2;
          const midY = (src.y + tgt.y) / 2;

          return (
            <g key={`edge-${i}`}>
              <line
                x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke={color} strokeWidth={width} strokeDasharray={dash}
                markerEnd={directed ? 'url(#arrowhead)' : undefined}
                className="transition-all duration-300"
              />
              {edge.label && (
                <text x={midX} y={midY - 4} textAnchor="middle" fill="#94a3b8" fontSize="10" className="pointer-events-none select-none">
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          const r = node.size || 18;
          const color = node.color || '#6366f1';
          const isDragging = dragNode === node.id;

          return (
            <g
              key={node.id}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              className="cursor-grab active:cursor-grabbing"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              {/* Shadow */}
              <circle cx={pos.x + 1} cy={pos.y + 1} r={r} fill="rgba(0,0,0,0.3)" />
              {/* Main circle */}
              <circle
                cx={pos.x} cy={pos.y} r={r}
                fill={color} stroke={isDragging ? '#fff' : 'rgba(255,255,255,0.3)'}
                strokeWidth={isDragging ? 2.5 : 1.5}
                className="transition-[stroke] duration-150"
              />
              {/* Inner highlight */}
              <circle cx={pos.x - r * 0.2} cy={pos.y - r * 0.2} r={r * 0.35} fill="rgba(255,255,255,0.15)" />
              {/* Label */}
              <text
                x={pos.x} y={pos.y + r + 14}
                textAnchor="middle" fill="#e2e8f0"
                fontSize="11" fontWeight="500"
                className="pointer-events-none select-none"
              >
                {node.label}
              </text>
              {/* Optional icon character */}
              {node.icon && (
                <text
                  x={pos.x} y={pos.y + 4}
                  textAnchor="middle" fill="white"
                  fontSize={r * 0.7} fontWeight="bold"
                  className="pointer-events-none select-none"
                >
                  {node.icon}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default React.memo(GraphVisual);
