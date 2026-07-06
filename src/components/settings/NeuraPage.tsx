import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useKnowledgeGraphStore } from '../../store/useKnowledgeGraphStore';
import { useMemoryStore } from '../../store/useMemoryStore';
import { SubPageHeader } from './SubPageHeader';
import type { Entity, Relationship } from '../../types/knowledge';

const COLORS: Record<string, string> = {
  person: '#a78bfa', project: '#fbbf24', concept: '#60a5fa',
  location: '#34d399', organization: '#f472b6', event: '#818cf8',
  date: '#2dd4bf', technology: '#22d3ee', tool: '#a3e635',
  topic: '#c084fc', habit: '#fb923c', goal: '#67e8f9',
  document: '#a78bfa', note: '#fdba74', preference: '#fde047',
  custom: '#94a3b8',
};

const EDGE_COLORS: Record<string, string> = {
  works_on: '#fbbf24', mentions: '#64748b', related_to: '#a78bfa',
  depends_on: '#f87171', part_of: '#60a5fa', located_in: '#34d399',
  created_by: '#f472b6', used_in: '#22d3ee', leads_to: '#818cf8',
  precedes: '#a3e635', follows: '#2dd4bf', contradicts: '#fb923c',
  prefers: '#fdba74', improves: '#34d399', blocks: '#ef4444',
  custom: '#94a3b8',
};

interface SphereNode {
  id: string; theta: number; phi: number; radius: number;
  entity: Entity; x: number; y: number; z: number;
}

interface Projected {
  id: string; sx: number; sy: number; sr: number; depth: number;
  entity: Entity; color: string;
}

const SPHERE_R = 220;

function nodeSize(e: Entity): number {
  return 4 + Math.min(e.mentionCount / 6, 1) * 12;
}

function fibonacciSphere(count: number, radius: number, entities: Entity[]): SphereNode[] {
  const nodes: SphereNode[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / count);
    const p = phi * i;
    const entity = entities[i];
    const r = nodeSize(entity);
    const x = radius * Math.sin(theta) * Math.cos(p);
    const y = radius * Math.sin(theta) * Math.sin(p);
    const z = radius * Math.cos(theta);
    nodes.push({ id: entity.id, theta, phi: p, radius: r, entity, x, y, z });
  }
  return nodes;
}

function rotateY(x: number, y: number, z: number, a: number) {
  return { x: x * Math.cos(a) + z * Math.sin(a), y, z: -x * Math.sin(a) + z * Math.cos(a) };
}
function rotateX(x: number, y: number, z: number, a: number) {
  return { x, y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) };
}

export const NeuraPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const raf = useRef<number>(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const idle = useRef(0);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  const [selected, setSelected] = useState<Entity | null>(null);
  const [connected, setConnected] = useState<{ entities: Entity[]; relationships: Relationship[] }>({ entities: [], relationships: [] });
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const entities = useKnowledgeGraphStore(s => s.entities);
  const relationships = useKnowledgeGraphStore(s => s.relationships);
  const memories = useMemoryStore(s => s.memories);

  const rot = useRef({ x: 0.35, y: 0 });
  const tRot = useRef({ x: 0.35, y: 0 });
  const zoom = useRef(1);
  const tZoom = useRef(1);
  const isDrag = useRef(false);

  const nodes = useRef<SphereNode[]>([]);
  const stars = useRef<{ x: number; y: number; r: number; a: number }[]>([]);

  // Init stars once
  useEffect(() => {
    if (stars.current.length > 0) return;
    const s: typeof stars.current = [];
    for (let i = 0; i < 120; i++) {
      s.push({ x: (Math.random() - 0.5) * 2000, y: (Math.random() - 0.5) * 2000, r: Math.random() * 1.2 + 0.3, a: Math.random() * 0.4 + 0.1 });
    }
    stars.current = s;
  }, []);

  useEffect(() => {
    if (entities.length === 0) return;
    const sorted = [...entities].sort((a, b) => b.mentionCount - a.mentionCount);
    nodes.current = fibonacciSphere(sorted.length, SPHERE_R, sorted);
    tRot.current = { x: 0.35, y: 0 };
    rot.current = { x: 0.35, y: 0 };
    tZoom.current = 1;
    zoom.current = 1;
    setSelected(null);
    setConnected({ entities: [], relationships: [] });
  }, [entities]);

  function getRelations(id: string) {
    const rels = relationships.filter(r => r.sourceId === id || r.targetId === id);
    const ids = new Set<string>();
    for (const r of rels) {
      if (r.sourceId !== id) ids.add(r.sourceId);
      if (r.targetId !== id) ids.add(r.targetId);
    }
    return { entities: entities.filter(e => ids.has(e.id)), relationships: rels };
  }

  function project(): Projected[] {
    const r = rot.current;
    const z = zoom.current;
    return nodes.current.map(n => {
      let p = rotateY(n.x, n.y, n.z, r.y);
      p = rotateX(p.x, p.y, p.z, r.x);
      const d = p.z;
      const persp = 700 / (p.z + 700);
      return {
        id: n.id, sx: p.x * persp * z, sy: p.y * persp * z,
        sr: Math.max(n.radius * persp * z, 1.5), depth: d,
        entity: n.entity, color: COLORS[n.entity.type] || '#94a3b8',
      };
    }).sort((a, b) => a.depth - b.depth);
  }

  function render() {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    const proj = project();
    const selId = selected?.id;

    const q = query.toLowerCase().trim();
    const hl = q ? new Set(entities.filter(e =>
      e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.aliases.some(a => a.toLowerCase().includes(q))
    ).map(e => e.id)) : null;

    // ── Stars ──
    for (const s of stars.current) {
      ctx.beginPath();
      ctx.arc(cx + s.x, cy + s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(148,163,184,${s.a})`;
      ctx.fill();
    }

    // ── Atmosphere ──
    const atm = ctx.createRadialGradient(cx, cy, 0, cx, cy, SPHERE_R * 1.6 * zoom.current);
    atm.addColorStop(0, 'rgba(168,85,247,0.04)');
    atm.addColorStop(0.5, 'rgba(99,102,241,0.025)');
    atm.addColorStop(1, 'transparent');
    ctx.fillStyle = atm;
    ctx.beginPath();
    ctx.arc(cx, cy, SPHERE_R * 1.6 * zoom.current, 0, Math.PI * 2);
    ctx.fill();

    // ── Equatorial ring ──
    ctx.beginPath();
    ctx.ellipse(cx, cy, SPHERE_R * 0.9 * zoom.current, SPHERE_R * 0.15 * zoom.current, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(168,85,247,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Edges ──
    const drawn = new Set<string>();
    for (const rel of relationships) {
      const a = proj.find(n => n.id === rel.sourceId);
      const b = proj.find(n => n.id === rel.targetId);
      if (!a || !b) continue;
      const k = [rel.sourceId, rel.targetId].sort().join('-');
      if (drawn.has(k)) continue;
      drawn.add(k);

      const isSel = selId && (rel.sourceId === selId || rel.targetId === selId);
      const isHl = hl && (hl.has(rel.sourceId) || hl.has(rel.targetId));
      const alpha = isSel ? 0.55 : isHl ? 0.25 : 0.06;
      const lw = isSel ? 1.5 + rel.strength * 2 : 0.4;
      const color = EDGE_COLORS[rel.type] || '#94a3b8';

      // Quadratic bezier arc along sphere surface
      const midX = (a.sx + b.sx) / 2;
      const midY = (a.sy + b.sy) / 2;
      const dist = Math.sqrt((b.sx - a.sx) ** 2 + (b.sy - a.sy) ** 2);
      const bulge = Math.min(dist * 0.25, 40);
      const angle = Math.atan2(b.sy - a.sy, b.sx - a.sx);
      const cpx = midX + Math.cos(angle + Math.PI / 2) * bulge;
      const cpy = midY + Math.sin(angle + Math.PI / 2) * bulge;

      ctx.beginPath();
      ctx.moveTo(cx + a.sx, cy + a.sy);
      ctx.quadraticCurveTo(cx + cpx, cy + cpy, cx + b.sx, cy + b.sy);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.stroke();

      // Glow on selected edges
      if (isSel) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;

    // ── Nodes ──
    for (const p of proj) {
      const sx = cx + p.sx;
      const sy = cy + p.sy;
      const sr = p.sr;
      const isSel = p.id === selId;
      const isHl = hl?.has(p.id);
      const back = (p.depth + SPHERE_R) / (SPHERE_R * 2);
      const front = isSel ? 1 : isHl ? 0.95 : 0.25 + back * 0.75;

      // Outer glow
      if (front > 0.3) {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
        g.addColorStop(0, isSel ? `${p.color}45` : `${p.color}12`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isSel) {
        // Pulse ring
        const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * (2 + pulse), 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.3 * pulse;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Body
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.globalAlpha = front;
      ctx.fillStyle = p.color;
      ctx.fill();

      // Ring
      ctx.strokeStyle = p.color;
      ctx.lineWidth = isSel ? 2.5 : isHl ? 1.5 : 0.8;
      ctx.globalAlpha = isSel ? 1 : isHl ? 0.8 : 0.3 + back * 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label
      if (zoom.current > 0.6 || isSel || isHl) {
        const fs = Math.max(7.5, Math.min(10.5, 9 * zoom.current));
        ctx.font = `${fs}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = isSel ? 1 : isHl ? 0.9 : 0.2 + back * 0.5;
        ctx.fillStyle = isSel ? p.color : 'rgba(255,255,255,0.6)';
        ctx.fillText(p.entity.name, sx, sy + sr + fs + 1);
        ctx.globalAlpha = 1;
      }
    }
  }

  function tick() {
    const r = rot.current;
    const tr = tRot.current;
    const dt = 0.06;
    r.x += (tr.x - r.x) * dt;
    r.y += (tr.y - r.y) * dt;

    // Auto-spin when idle
    idle.current += 1;
    if (idle.current > 90 && !isDrag.current) {
      tr.y += 0.003;
    }

    zoom.current += (tZoom.current - zoom.current) * 0.1;
    render();
    raf.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [entities, relationships, selected, query]);

  const hWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    idle.current = 0;
    tZoom.current = Math.max(0.3, Math.min(4, tZoom.current * (1 - e.deltaY * 0.002)));
  }, []);

  const hDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    idle.current = 0;
    if (pointers.current.size === 1) {
      isDrag.current = true;
      drag.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.sqrt((pts[1].x - pts[0].x) ** 2 + (pts[1].y - pts[0].y) ** 2);
      pinch.current = { dist, zoom: zoom.current };
      isDrag.current = false;
      drag.current = null;
    }
  }, []);

  const hMove = useCallback((e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    idle.current = 0;

    if (pointers.current.size === 2 && pinch.current) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.sqrt((pts[1].x - pts[0].x) ** 2 + (pts[1].y - pts[0].y) ** 2);
      const scale = dist / pinch.current.dist;
      tZoom.current = Math.max(0.3, Math.min(4, pinch.current.zoom * scale));
      return;
    }

    if (!isDrag.current || !drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    tRot.current = { x: rot.current.x + dy * 0.006, y: rot.current.y + dx * 0.006 };
    drag.current = { x: e.clientX, y: e.clientY };
  }, []);

  const hUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;

    if (pointers.current.size > 0) {
      // Still have one pointer left — switch to drag
      const remaining = Array.from(pointers.current.values())[0];
      isDrag.current = true;
      drag.current = { x: remaining.x, y: remaining.y };
      return;
    }

    if (!isDrag.current) return;
    const dx = e.clientX - (drag.current?.x || e.clientX);
    const dy = e.clientY - (drag.current?.y || e.clientY);
    const wasDrag = Math.abs(dx) > 4 || Math.abs(dy) > 4;
    isDrag.current = false;
    drag.current = null;

    if (wasDrag) { idle.current = 0; return; }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = containerRef.current!.clientWidth / 2;
    const cy = containerRef.current!.clientHeight / 2;
    const proj = project();

    const hit = proj.find(p => {
      const d = Math.sqrt((mx - cx - p.sx) ** 2 + (my - cy - p.sy) ** 2);
      return d <= p.sr + 6;
    });

    if (hit && hit.depth > -SPHERE_R * 0.5) {
      if (selected?.id === hit.id) {
        tRot.current = { x: 0.35, y: 0 };
        tZoom.current = 1;
        setSelected(null);
        setConnected({ entities: [], relationships: [] });
        return;
      }
      setSelected(hit.entity);
      setConnected(getRelations(hit.id));
      tZoom.current = 1.5;
    } else if (selected) {
      tRot.current = { x: 0.35, y: 0 };
      tZoom.current = 1;
      setSelected(null);
      setConnected({ entities: [], relationships: [] });
    }
  }, [selected]);

  const hasData = entities.length > 0;

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const res: { id: string; label: string; sub: string; type: 'entity' | 'memory'; color: string }[] = [];
    for (const e of entities) {
      if (e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.aliases.some(a => a.toLowerCase().includes(q)))
        res.push({ id: e.id, label: e.name, sub: e.type, type: 'entity', color: COLORS[e.type] || '#94a3b8' });
    }
    for (const m of memories) {
      if (m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q))
        res.push({ id: m.id, label: m.key, sub: m.value.slice(0, 60), type: 'memory', color: '#818cf8' });
    }
    return res.slice(0, 30);
  }, [query, entities, memories]);

  function focusEntity(id: string) {
    const entity = entities.find(e => e.id === id);
    if (!entity) return;
    const node = nodes.current.find(n => n.id === id);
    if (!node) return;
    tRot.current = { x: -(node.theta - Math.PI / 2), y: -node.phi };
    tZoom.current = 1.5;
    setSelected(entity);
    setConnected(getRelations(id));
    setShowSearch(false);
    setQuery('');
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3 shrink-0">
        <SubPageHeader title="Neura" onBack={onBack} />
        <button
          onClick={() => { setShowSearch(s => !s); if (!showSearch) setTimeout(() => searchRef.current?.focus(), 100); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center tap-feedback shrink-0"
          style={{ background: showSearch ? 'rgba(168,85,247,0.12)' : 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
        >
          {showSearch ? <X size={14} style={{ color: '#a855f7' }} /> : <Search size={14} style={{ color: 'var(--gia-muted)' }} />}
        </button>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onWheel={hWheel}
          onPointerDown={hDown}
          onPointerMove={hMove}
          onPointerUp={hUp}
          onPointerLeave={hUp}
        />

        <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px]" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <span style={{ color: 'rgba(148,163,184,0.6)' }}>{entities.length} nodes</span>
            <span style={{ color: 'rgba(148,163,184,0.3)' }}>·</span>
            <span style={{ color: 'rgba(148,163,184,0.6)' }}>{relationships.length} edges</span>
            {selected && (
              <>
                <span style={{ color: 'rgba(148,163,184,0.3)' }}>·</span>
                <span style={{ color: '#a78bfa' }}>{selected.name}</span>
              </>
            )}
          </div>
        </div>

        {showSearch && (
          <div className="absolute top-0 left-0 right-0 p-3 z-10">
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(14,14,20,0.96)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <Search size={13} style={{ color: 'rgba(148,163,184,0.5)' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search knowledge sphere…"
                  className="flex-1 bg-transparent text-[12px] outline-none"
                  style={{ color: 'var(--gia-text)' }}
                />
                {query && <button onClick={() => setQuery('')} className="p-0.5"><X size={11} style={{ color: 'rgba(148,163,184,0.5)' }} /></button>}
              </div>
              {query && searchResults.length > 0 && (
                <div className="max-h-44 overflow-y-auto py-1">
                  {searchResults.map(r => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => r.type === 'entity' ? focusEntity(r.id) : null}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="w-4 h-4 rounded flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{r.label}</p>
                        <p className="text-[8px] truncate" style={{ color: 'rgba(148,163,184,0.5)' }}>{r.sub}</p>
                      </div>
                      <span className="text-[7px] uppercase tracking-wider shrink-0" style={{ color: r.color }}>{r.type}</span>
                    </button>
                  ))}
                </div>
              )}
              {query && searchResults.length === 0 && <p className="text-[11px] text-center py-4" style={{ color: 'rgba(148,163,184,0.4)' }}>No matches found</p>}
            </div>
          </div>
        )}

        {!hasData && !showSearch && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center px-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><circle cx="4.93" cy="4.93" r="1" />
                  <circle cx="19.07" cy="4.93" r="1" /><circle cx="4.93" cy="19.07" r="1" /><circle cx="19.07" cy="19.07" r="1" />
                  <line x1="8.7" y1="8.7" x2="6.34" y2="6.34" /><line x1="15.3" y1="8.7" x2="17.66" y2="6.34" />
                  <line x1="8.7" y1="15.3" x2="6.34" y2="17.66" /><line x1="15.3" y1="15.3" x2="17.66" y2="17.66" />
                </svg>
              </div>
              <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>The sphere is dark</p>
              <p className="text-[10px] mt-1.5 leading-relaxed max-w-xs mx-auto" style={{ color: 'rgba(148,163,184,0.35)' }}>
                Every entity, concept, and connection GIA discovers appears as a node. Spin the sphere to explore. It grows as you do.
              </p>
            </div>
          </div>
        )}

        {selected && (
          <div
            className="absolute bottom-0 left-0 right-0 px-5 pt-8 pb-5"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.93) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
              pointerEvents: 'auto',
            }}
          >
            <div className="max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${COLORS[selected.type] || '#94a3b8'}18`, border: `1px solid ${COLORS[selected.type] || '#94a3b8'}25` }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[selected.type] || '#94a3b8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{selected.name}</p>
                  <p className="text-[9px]" style={{ color: `${COLORS[selected.type] || '#94a3b8'}` }}>
                    {selected.type} · {selected.mentionCount}m · {(selected.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              {selected.description && (
                <p className="text-[10.5px] mb-3 leading-relaxed" style={{ color: 'rgba(148,163,184,0.65)' }}>{selected.description}</p>
              )}
              {connected.entities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {connected.entities.slice(0, 8).map(e => {
                    const rel = connected.relationships.find(r => r.sourceId === e.id || r.targetId === e.id);
                    return (
                      <div key={e.id} className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px]" style={{ background: `${COLORS[e.type] || '#94a3b8'}0d`, border: `1px solid ${COLORS[e.type] || '#94a3b8'}15` }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[e.type] || '#94a3b8' }} />
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{e.name}</span>
                        {rel && <span className="text-[7px]" style={{ color: `${EDGE_COLORS[rel.type] || '#94a3b8'}` }}>{rel.type.replace(/_/g, ' ')}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
