import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Search, X, Maximize2, Minimize2, Network, TrendingUp, Download, Upload } from 'lucide-react';
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
  return 5 + Math.min(e.mentionCount / 4, 1) * 16;
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

function formatTimeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
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
  const [expanded, setExpanded] = useState(true);

  const entities = useKnowledgeGraphStore(s => s.entities);
  const relationships = useKnowledgeGraphStore(s => s.relationships);
  const memories = useMemoryStore(s => s.memories);

  const rot = useRef({ x: 0.35, y: 0 });
  const tRot = useRef({ x: 0.35, y: 0 });
  const zoom = useRef(1);
  const tZoom = useRef(1);
  const isDrag = useRef(false);
  const momentum = useRef(false);
  const vel = useRef({ x: 0, y: 0 });

  const nodes = useRef<SphereNode[]>([]);
  const stars = useRef<{ x: number; y: number; r: number; a: number; phase: number; twinkleSpeed: number }[]>([]);

  // Init stars once — fewer on lower-end / low-memory devices so the
  // background twinkle doesn't compete with real rendering work for frame time.
  useEffect(() => {
    if (stars.current.length > 0) return;
    const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    const starCount = deviceMemory && deviceMemory <= 4 ? 80 : 200;
    const s: typeof stars.current = [];
    for (let i = 0; i < starCount; i++) {
      s.push({
        x: (Math.random() - 0.5) * 2500,
        y: (Math.random() - 0.5) * 2500,
        r: Math.random() * 1.5 + 0.2,
        a: Math.random() * 0.5 + 0.05,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
      });
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

  const getRelations = useCallback((id: string) => {
    const rels = relationships.filter(r => r.sourceId === id || r.targetId === id);
    const ids = new Set<string>();
    for (const r of rels) {
      if (r.sourceId !== id) ids.add(r.sourceId);
      if (r.targetId !== id) ids.add(r.targetId);
    }
    return { entities: entities.filter(e => ids.has(e.id)), relationships: rels };
  }, [entities, relationships]);

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

    // Single timestamp for all pulses this frame — prevents phase desync
    const now = Date.now();
    for (const s of stars.current) {
      const twinkle = Math.sin(now * s.twinkleSpeed + s.phase) * 0.4 + 0.6;
      ctx.beginPath();
      ctx.arc(cx + s.x, cy + s.y, s.r * (0.6 + twinkle * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,190,210,${s.a * twinkle})`;
      ctx.fill();
    }

    // ── Hot core (pulsing center) ──
    const corePulse = Math.sin(now * 0.003) * 0.2 + 0.8;
    const coreR = SPHERE_R * 0.08 * zoom.current * corePulse;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
    core.addColorStop(0, 'rgba(255,255,255,0.4)');
    core.addColorStop(0.3, 'rgba(168,85,247,0.2)');
    core.addColorStop(0.6, 'rgba(99,102,241,0.08)');
    core.addColorStop(1, 'transparent');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
    ctx.fill();

    const whiteCore = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    whiteCore.addColorStop(0, 'rgba(255,255,255,0.6)');
    whiteCore.addColorStop(0.5, 'rgba(200,150,255,0.15)');
    whiteCore.addColorStop(1, 'transparent');
    ctx.fillStyle = whiteCore;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // ── Atmosphere (brighter) ──
    const atm = ctx.createRadialGradient(cx, cy, 0, cx, cy, SPHERE_R * 2 * zoom.current);
    atm.addColorStop(0, 'rgba(168,85,247,0.12)');
    atm.addColorStop(0.2, 'rgba(139,92,246,0.08)');
    atm.addColorStop(0.5, 'rgba(99,102,241,0.04)');
    atm.addColorStop(0.8, 'rgba(59,130,246,0.02)');
    atm.addColorStop(1, 'transparent');
    ctx.fillStyle = atm;
    ctx.beginPath();
    ctx.arc(cx, cy, SPHERE_R * 2 * zoom.current, 0, Math.PI * 2);
    ctx.fill();

    // ── Energy rings (pulsing) ──
    const ringPulse1 = Math.sin(now * 0.002) * 0.3 + 0.7;
    const ringPulse2 = Math.sin(now * 0.0015 + 1.5) * 0.3 + 0.7;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI + now * 0.0002;
      const rx = SPHERE_R * (0.7 + i * 0.12) * zoom.current;
      const ry = SPHERE_R * (0.15 + i * 0.06) * zoom.current;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, angle, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(168,85,247,${0.04 * (i === 0 ? ringPulse1 : ringPulse2)})`;
      ctx.lineWidth = 0.6 + (3 - i) * 0.3;
      ctx.stroke();
    }

    // ── Pulsing longitude arcs ──
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI + now * 0.0003;
      const pulse = Math.sin(now * 0.001 + i) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, SPHERE_R * 0.65 * zoom.current, SPHERE_R * 0.65 * zoom.current, angle, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139,92,246,${0.02 * pulse})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // ── Edges (pulsing, brighter) ──
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

      // Per-edge pulse using now + index as phase offset
      const edgePhase = drawn.size * 0.7;
      const pulse = Math.sin(now * 0.0025 + edgePhase) * 0.25 + 0.75;

      const baseAlpha = isSel ? 0.7 : isHl ? 0.4 : 0.15;
      const alpha = baseAlpha * pulse;
      const lw = isSel ? 2 + rel.strength * 2 : isHl ? 0.9 : 0.5;
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

      // Glow on all edges (pulsing)
      ctx.shadowColor = color;
      ctx.shadowBlur = isSel ? 12 : isHl ? 4 : 2;
      ctx.globalAlpha = alpha * 0.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
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
      const front = isSel ? 1 : isHl ? 0.95 : 0.3 + back * 0.7;

      // Outer glow
      const glowRadius = sr * (isSel ? 8 : 5);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
      g.addColorStop(0, isSel ? `${p.color}55` : `${p.color}18`);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = Math.max(0.4, front);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      if (isSel) {
        // Pulse ring
        const pulse = Math.sin(now * 0.004) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * (2.5 + pulse * 0.5), 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.4 * pulse;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Second wider pulse
        const pulse2 = Math.sin(now * 0.0025 + 1) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * (4 + pulse2), 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.15 * pulse2;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Body
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.globalAlpha = Math.max(0.6, front);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Highlight on front-facing nodes
      if (front > 0.6 && !isSel) {
        ctx.beginPath();
        ctx.arc(sx - sr * 0.25, sy - sr * 0.25, sr * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.globalAlpha = front * 0.5;
        ctx.fill();
      }

      // Ring
      ctx.strokeStyle = p.color;
      ctx.lineWidth = isSel ? 3 : isHl ? 2 : 1.2;
      ctx.globalAlpha = isSel ? 1 : isHl ? 0.85 : 0.35 + back * 0.45;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label
      if (zoom.current > 0.5 || isSel || isHl) {
        const fs = Math.max(7, Math.min(11, 9.5 * zoom.current));
        ctx.font = `${isSel ? '600 ' : ''}${fs}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = isSel ? 1 : isHl ? 0.9 : 0.25 + back * 0.55;
        ctx.fillStyle = isSel ? p.color : 'rgba(255,255,255,0.65)';
        ctx.shadowColor = isSel ? p.color : 'transparent';
        ctx.shadowBlur = isSel ? 8 : 0;
        ctx.fillText(p.entity.name, sx, sy + sr + fs + 2);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }
  }

  function tick() {
    const r = rot.current;
    const tr = tRot.current;

    if (isDrag.current) {
      // Direct follow with light smoothing during drag
      r.x += (tr.x - r.x) * 0.12;
      r.y += (tr.y - r.y) * 0.12;
    } else if (momentum.current) {
      // Decaying momentum after drag release — feels like inertia
      r.x += vel.current.x;
      r.y += vel.current.y;
      vel.current.x *= 0.97;
      vel.current.y *= 0.97;
      if (Math.abs(vel.current.x) < 0.00005 && Math.abs(vel.current.y) < 0.00005) {
        momentum.current = false;
      }
    } else {
      // Gentle lerp toward target (idle / auto-spin)
      r.x += (tr.x - r.x) * 0.05;
      r.y += (tr.y - r.y) * 0.05;
    }

    // Auto-spin when idle (smoother ramp-up)
    if (!isDrag.current && !momentum.current) {
      idle.current += 1;
      if (idle.current > 120) {
        const speed = Math.min((idle.current - 120) / 200, 1) * 0.004;
        tr.y += speed;
      }
    } else {
      idle.current = 0;
    }

    zoom.current += (tZoom.current - zoom.current) * (isDrag.current ? 0.3 : 0.12);
    render();
    if (!document.hidden) raf.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    const startLoop = () => { raf.current = requestAnimationFrame(tick); };
    const stopLoop = () => { if (raf.current) cancelAnimationFrame(raf.current); };
    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (!document.hidden) startLoop();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopLoop();
    };
    // tick uses refs intentionally — no external deps needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, relationships, selected, query]);

  const hWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    idle.current = 0;
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    tZoom.current = Math.max(0.25, Math.min(5, tZoom.current * factor));
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
      tZoom.current = Math.max(0.25, Math.min(5, pinch.current.zoom * scale));
      return;
    }

    if (!isDrag.current || !drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    tRot.current = { x: rot.current.x + dy * 0.008, y: rot.current.y + dx * 0.008 };
    vel.current = { x: dx * 0.008, y: dy * 0.008 };
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

    if (wasDrag) {
      momentum.current = true;
      idle.current = 0;
      return;
    }

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
  }, [selected, getRelations]);

  const hasData = entities.length > 0;

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    // Precompute connection counts so results can show how well-wired each entity is
    const relCount = new Map<string, number>();
    for (const r of relationships) {
      relCount.set(r.sourceId, (relCount.get(r.sourceId) || 0) + 1);
      relCount.set(r.targetId, (relCount.get(r.targetId) || 0) + 1);
    }
    const res: { id: string; label: string; sub: string; type: 'entity' | 'memory'; color: string; conns: number }[] = [];
    for (const e of entities) {
      if (e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.aliases.some(a => a.toLowerCase().includes(q))) {
        const desc = e.description ? e.description.slice(0, 60) : '';
        res.push({
          id: e.id, label: e.name,
          sub: desc || e.type,
          type: 'entity', color: COLORS[e.type] || '#94a3b8',
          conns: relCount.get(e.id) || 0,
        });
      }
    }
    for (const m of memories) {
      if (m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q))
        res.push({ id: m.id, label: m.key, sub: m.value.slice(0, 60), type: 'memory', color: '#818cf8', conns: 0 });
    }
    return res.slice(0, 30);
  }, [query, entities, memories, relationships]);

  async function handleExport() {
    const kg = useKnowledgeGraphStore.getState();
    const mem = useMemoryStore.getState();
    const payload = {
      exportedAt: Date.now(),
      version: 1,
      knowledgeGraph: { entities: kg.entities, relationships: kg.relationships, mentions: kg.mentions },
      memories: mem.memories,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gia-neura-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.knowledgeGraph || !data.memories) {
          alert('Invalid Neura backup file');
          return;
        }
        const kg = useKnowledgeGraphStore.getState();
        // Merge: add each entity/relationship/mention from backup
        for (const e of data.knowledgeGraph.entities) {
          kg.addEntity({
            name: e.name, type: e.type, aliases: e.aliases || [],
            description: e.description || '', confidence: e.confidence || 0.5,
            metadata: e.metadata || {},
          });
        }
        for (const r of data.knowledgeGraph.relationships) {
          kg.addRelationship({
            sourceId: r.sourceId, targetId: r.targetId, type: r.type,
            strength: r.strength || 0.5, context: r.context || '',
          });
        }
        for (const m of data.knowledgeGraph.mentions) {
          kg.addMention({
            entityId: m.entityId, messageId: m.messageId,
            timestamp: m.timestamp, context: m.context || '',
          });
        }
        const memStore = useMemoryStore.getState();
        for (const m of data.memories) {
          memStore.addMemory({
            key: m.key, value: m.value, category: m.category, tier: m.tier,
            confidence: m.confidence || 0.5,
          });
        }
      } catch {
        alert('Failed to import Neura backup — file may be corrupted');
      }
    };
    input.click();
  }

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

  const entityTypeCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entities) counts[e.type] = (counts[e.type] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [entities]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3 shrink-0">
        <SubPageHeader title="Neura" onBack={onBack} />
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            className="w-8 h-8 rounded-lg flex items-center justify-center tap-feedback shrink-0"
            style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
            title="Export Neura state"
          >
            <Download size={13} style={{ color: 'var(--gia-muted)' }} />
          </button>
          <button
            onClick={handleImport}
            className="w-8 h-8 rounded-lg flex items-center justify-center tap-feedback shrink-0"
            style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
            title="Import Neura state"
          >
            <Upload size={13} style={{ color: 'var(--gia-muted)' }} />
          </button>
          <button
            onClick={() => { setShowSearch(s => !s); if (!showSearch) setTimeout(() => searchRef.current?.focus(), 100); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center tap-feedback shrink-0"
            style={{ background: showSearch ? 'rgba(168,85,247,0.12)' : 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
          >
            {showSearch ? <X size={14} style={{ color: '#a855f7' }} /> : <Search size={14} style={{ color: 'var(--gia-muted)' }} />}
          </button>
          <button
            onClick={() => setExpanded(s => !s)}
            className="w-8 h-8 rounded-lg flex items-center justify-center tap-feedback shrink-0"
            style={{ background: expanded ? 'rgba(168,85,247,0.12)' : 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 size={14} style={{ color: '#a855f7' }} /> : <Maximize2 size={14} style={{ color: 'var(--gia-muted)' }} />}
          </button>
        </div>
      </div>

      {expanded ? (
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
                          {r.type === 'entity' && r.conns > 0 && (
                            <p className="text-[7px] truncate" style={{ color: 'rgba(168,85,247,0.6)' }}>⚡ {r.conns} connection{r.conns === 1 ? '' : 's'}</p>
                          )}
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
                <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)', border: '1px solid rgba(168,85,247,0.15)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><circle cx="4.93" cy="4.93" r="1" />
                    <circle cx="19.07" cy="4.93" r="1" /><circle cx="4.93" cy="19.07" r="1" /><circle cx="19.07" cy="19.07" r="1" />
                    <line x1="8.7" y1="8.7" x2="6.34" y2="6.34" /><line x1="15.3" y1="8.7" x2="17.66" y2="6.34" />
                    <line x1="8.7" y1="15.3" x2="6.34" y2="17.66" /><line x1="15.3" y1="15.3" x2="17.66" y2="17.66" />
                  </svg>
                </div>
                <p className="text-xs font-medium" style={{ color: 'rgba(168,85,247,0.6)' }}>The sphere is dark</p>
                <p className="text-[10px] mt-1.5 leading-relaxed max-w-xs mx-auto" style={{ color: 'rgba(148,163,184,0.4)' }}>
                  Every entity, concept, and connection GIA discovers appears as a glowing node. The more you talk, the brighter it gets. Spin, zoom, explore — the sphere grows as you do.
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
      ) : (
        /* ── Compact preview card ── */
        <div className="flex-1 flex flex-col p-4 pt-2 gap-3 overflow-y-auto">
          <div
            className="rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer tap-feedback"
            style={{ background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.06) 0%, transparent 70%)', border: '1px solid rgba(168,85,247,0.1)' }}
            onClick={() => setExpanded(true)}
          >
            <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 60%)', animation: 'pulse 3s ease-in-out infinite' }} />
              <div className="relative flex flex-wrap items-center justify-center gap-1" style={{ maxWidth: 80 }}>
                {entityTypeCount.slice(0, 6).map(([type]) => (
                  <div key={type} className="w-3 h-3 rounded-full" style={{ background: COLORS[type] || '#94a3b8', opacity: 0.8 }} />
                ))}
                {entityTypeCount.length === 0 && <Network size={28} style={{ color: 'rgba(168,85,247,0.4)' }} />}
              </div>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>
              {hasData ? `${entities.length} entities · ${relationships.length} connections` : 'The sphere is dark'}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>
              {hasData ? `Tap to explore · ${entityTypeCount.slice(0, 3).map(([t, c]) => `${t} (${c})`).join(', ')}` : 'Knowledge accumulates as you talk — entities, concepts, connections.'}
            </p>
            {hasData && (
              <div className="flex items-center gap-4 mt-3 text-[9px]" style={{ color: 'rgba(148,163,184,0.4)' }}>
                <span>{memories.length} memories linked</span>
              </div>
            )}
          </div>

          {entityTypeCount.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              {entityTypeCount.map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px]"
                  style={{ background: `${COLORS[type] || '#94a3b8'}0d`, border: `1px solid ${COLORS[type] || '#94a3b8'}18` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[type] || '#94a3b8' }} />
                  <span style={{ color: COLORS[type] || '#94a3b8' }}>{type}</span>
                  <span style={{ color: 'rgba(148,163,184,0.4)' }}>{count}</span>
                </div>
              ))}
            </div>
          )}

          {entities.length > 0 && (
            <div className="px-1 space-y-4">
              {/* ── Learning Velocity ── */}
              <div className="flex items-center gap-4 px-2.5 py-2 rounded-lg" style={{ background: 'var(--gia-surface-2)' }}>
                <TrendingUp size={14} style={{ color: 'rgba(168,85,247,0.5)' }} />
                {(() => {
                  const now = Date.now();
                  const dayMs = 86400000;
                  const dayAgo = now - dayMs;
                  const weekAgo = now - 7 * dayMs;
                  const new24h = entities.filter(e => e.firstMentioned > dayAgo).length;
                  const new7d = entities.filter(e => e.firstMentioned > weekAgo).length;
                  const active7d = entities.filter(e => e.lastMentioned > weekAgo).length;
                  const newRels = relationships.filter(r => r.firstObserved > weekAgo).length;
                  return (
                    <div className="flex items-center gap-3 text-[9px]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                      <span>+{new24h} today</span>
                      <span className="opacity-30">·</span>
                      <span>+{new7d}/7d</span>
                      <span className="opacity-30">·</span>
                      <span>{active7d} active</span>
                      <span className="opacity-30">·</span>
                      <span>+{newRels} links</span>
                    </div>
                  );
                })()}
              </div>

              {/* ── Knowledge Activity Feed ── */}
              <div>
                <p className="text-[9px] font-medium mb-2 flex items-center gap-1.5" style={{ color: 'rgba(148,163,184,0.4)' }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
                  Recent knowledge
                </p>
                <div className="flex flex-col gap-1">
                  {[...entities]
                    .sort((a, b) => b.lastMentioned - a.lastMentioned)
                    .slice(0, 8)
                    .map(e => {
                      const mentions = useKnowledgeGraphStore.getState().mentions
                        .filter(m => m.entityId === e.id)
                        .sort((a, b) => b.timestamp - a.timestamp);
                      const last = mentions[0];
                      const timeAgo = last ? formatTimeAgo(last.timestamp) : '';
                                      return (
                        <div key={e.id} className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: 'var(--gia-surface-2)' }}>
                          <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ background: COLORS[e.type] || '#94a3b8' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{e.name}</span>
                              <span className="text-[7px] uppercase tracking-wider shrink-0" style={{ color: COLORS[e.type] || '#94a3b8' }}>{e.type}</span>
                              {timeAgo && <span className="text-[7px] shrink-0 ml-auto" style={{ color: 'rgba(148,163,184,0.3)' }}>{timeAgo}</span>}
                            </div>
                            {e.description && (
                              <p className="text-[9px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'rgba(148,163,184,0.55)' }}>
                                {e.description}
                              </p>
                            )}
                            {last && last.context && (
                              <p className="text-[8px] mt-0.5 italic truncate" style={{ color: 'rgba(148,163,184,0.3)' }}>
                                "{last.context.slice(0, 100)}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* ── Knowledge Depth ── */}
              <div>
                <p className="text-[9px] font-medium mb-2" style={{ color: 'rgba(148,163,184,0.4)' }}>Most understood</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[...entities]
                    .sort((a, b) => b.mentionCount - a.mentionCount)
                    .slice(0, 4)
                    .map(e => (
                      <div key={e.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'var(--gia-surface-2)' }}>
                        <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ background: COLORS[e.type] || '#94a3b8' }} />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-medium block truncate" style={{ color: 'var(--gia-text)' }}>{e.name}</span>
                          <span className="text-[7px]" style={{ color: 'rgba(148,163,184,0.3)' }}>
                            {e.type} · {(e.confidence * 100).toFixed(0)}% confidence · {e.mentionCount} mentions
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
