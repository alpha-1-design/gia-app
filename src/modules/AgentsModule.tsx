import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, X, Trash2, Upload, FileText,
  ChevronLeft, Send, Loader2, Settings2,
  Code2, Cpu, Image,
  AlertTriangle, RefreshCw, Search, Globe, Sparkles,
  ArrowUpDown, MessageSquare, Check, Filter,
  type LucideIcon,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAgentStore, type CustomAgent, type AgentMessage, type AgentSource, searchAgentRAG } from '../store/useAgentStore';
import GiaBrain from '../services/GiaBrain';
import giaTools from '../services/GiaTools';
import { useGiaStore } from '../store/useGiaStore';
import { genId } from '../utils/id';
import { resolveAgentIcon } from '../utils/agentIcons';
import MarkdownRenderer from '../components/MarkdownRenderer';
import OrbAvatar from '../components/OrbAvatar';

// ── Max messages per agent chat session stored in IDB ──────────────────────
const MAX_MESSAGES_PER_SESSION = 100;

type ViewState = 'list' | 'chat';
type SortOption = 'newest' | 'alphabetical' | 'tools' | 'files';

const AGENT_ICONS: { name: string; color: string }[] = [
  { name: 'Bot', color: '#a855f7' },
  { name: 'Brain', color: '#ec4899' },
  { name: 'Code2', color: '#3b82f6' },
  { name: 'Wand2', color: '#f59e0b' },
  { name: 'Sparkles', color: '#fbbf24' },
  { name: 'Star', color: '#fbbf24' },
  { name: 'Rocket', color: '#ef4444' },
  { name: 'Zap', color: '#f59e0b' },
  { name: 'Globe', color: '#34d399' },
  { name: 'BookOpen', color: '#6366f1' },
  { name: 'GraduationCap', color: '#f59e0b' },
  { name: 'Palette', color: '#ec4899' },
  { name: 'PenLine', color: '#06b6d4' },
  { name: 'BarChart2', color: '#3b82f6' },
  { name: 'Search', color: '#8b5cf6' },
  { name: 'Target', color: '#ef4444' },
  { name: 'Shield', color: '#34d399' },
  { name: 'Compass', color: '#10b981' },
  { name: 'Cpu', color: '#a855f7' },
  { name: 'Database', color: '#6366f1' },
  { name: 'Lightbulb', color: '#fbbf24' },
  { name: 'Cloud', color: '#3b82f6' },
  { name: 'Gem', color: '#ec4899' },
  { name: 'Crown', color: '#f59e0b' },
  { name: 'Flame', color: '#ef4444' },
  { name: 'Feather', color: '#a855f7' },
  { name: 'Mic', color: '#06b6d4' },
  { name: 'MessageCircle', color: '#34d399' },
  { name: 'Image', color: '#8b5cf6' },
  { name: 'Music', color: '#ec4899' },
  { name: 'Camera', color: '#6366f1' },
  { name: 'Eye', color: '#10b981' },
  { name: 'Share2', color: '#3b82f6' },
  { name: 'Link', color: '#a855f7' },
  { name: 'Award', color: '#f59e0b' },
  { name: 'Sun', color: '#fbbf24' },
  { name: 'Moon', color: '#6366f1' },
  { name: 'Wind', color: '#34d399' },
  { name: 'Leaf', color: '#10b981' },
  { name: 'Download', color: '#3b82f6' },
  { name: 'Hash', color: '#a855f7' },
  { name: 'Flag', color: '#ef4444' },
];

// ── Tool picker ─────────────────────────────────────────────────────────────
// The registry registers ~100 tools at app startup (registerAllTools). The
// picker is generated from that registry instead of a hand-curated list of
// ~14, so agents can be granted ANY capability GIA has — social posting,
// security scans, SSH, databases, smart-home control, WebSockets, MCP, etc.
const CATEGORY_RULES: { test: (id: string) => boolean; category: string; icon: LucideIcon }[] = [
  { test: (id) => ['web_search', 'read_url', 'browser_navigate', 'wikipedia', 'page_info', 'search_places', 'show_map', 'get_directions', 'web_scrape', 'http_request', 'network_scan', 'network_connectivity', 'network_detect'].includes(id), category: 'web', icon: Globe },
  { test: (id) => /^(terminal_|code_|build_|zip_|github|ssh_|db_|filegen|create_pdf|read_pdf|document)/.test(id), category: 'code', icon: Code2 },
  { test: (id) => /^(filesystem_|list_files|file_|rag_|neura_)/.test(id), category: 'files', icon: FileText },
  { test: (id) => /^(image_|save_memory|forget_memory|request_clarification|summarize_|brain_|skill)/.test(id), category: 'creative', icon: Image },
  { test: (id) => /^(social_|connector_|gateway_|telegram_|messaging_|smart_|security_|autonomy|goal|scheduled|calendar|email_|mcp_|plugin_|ws_)/.test(id), category: 'system', icon: Cpu },
  { test: () => true, category: 'system', icon: Cpu },
];

function toolDisplayLabel(id: string): string {
  return id.split('_').map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

function getAllAgentTools(): { id: string; label: string; icon: LucideIcon; description: string; category: string }[] {
  return giaTools.getAllTools()
    .map(t => {
      const rule = CATEGORY_RULES.find(r => r.test(t.id)) || CATEGORY_RULES[CATEGORY_RULES.length - 1];
      return {
        id: t.id,
        label: toolDisplayLabel(t.id),
        icon: rule.icon,
        description: t.description || '',
        category: rule.category,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All Agents' },
  { id: 'web', label: 'Web & Search' },
  { id: 'code', label: 'Code & Dev' },
  { id: 'files', label: 'Files & Storage' },
  { id: 'creative', label: 'AI & Creative' },
  { id: 'system', label: 'System Tools' },
];

function getIconColor(name: string): string {
  return AGENT_ICONS.find(i => i.name === name)?.color || '#a855f7';
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  web_search: 'Search the web for current information',
  read_url: 'Extract clean content from any URL',
  terminal_run: 'Execute code (Python, JavaScript, bash) in an isolated sandbox',
  filesystem_read: 'Read a file from the device by path',
  filesystem_write: 'Write or save a file to the device',
  image_generation: 'Generate an image from a text description',
  browser_navigate: 'Open a full JavaScript-rendered web page in an iframe',
  get_user_location: 'Get the user\'s current GPS location',
  weather: 'Get current weather for any city',
  wikipedia: 'Get a Wikipedia article summary',
  github: 'Access GitHub user, repo, or file data',
  save_memory: 'Save a fact or preference to long-term memory',
  device_info: 'Get device information like battery, OS, and network',
  clipboard: 'Read from or write to the system clipboard',
};

// ── Module-level error boundary ─────────────────────────────────────────────
interface EBState { hasError: boolean; error: Error | null }
class AgentErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  EBState
> {
  state: EBState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center" style={{ background: 'var(--gia-bg)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={22} style={{ color: '#f87171' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Agents view encountered an error</p>
          <p className="text-xs leading-relaxed max-w-[260px]" style={{ color: 'var(--gia-muted)' }}>
            {this.state.error?.message || 'Something went wrong'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-medium mt-2 tap-feedback"
            style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
          >
            <RefreshCw size={12} /> Reload Agents
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
// ────────────────────────────────────────────────────────────────────────────

// Stable particle positions — computed ONCE, never on re-render
const PARTICLE_CONFIGS = Array.from({ length: 8 }, (_, i) => ({
  orbitR: 50 + (i * 17 % 70),
  delay: (i * 0.37) % 3,
  duration: 4 + (i * 0.61 % 4),
  size: 1 + (i % 2),
  alpha: 0.3 + (i * 0.08 % 0.4),
  colorOffset: i * 5,
}));

const AgentsModule: React.FC = () => {
  const { agents, removeAgent } = useAgentStore(useShallow(s => ({
    agents: s.agents || [],
    removeAgent: s.removeAgent,
  })));

  const [view, setView] = useState<ViewState>('list');
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editAgentId, setEditAgentId] = useState<string | null>(null);

  const safeAgents = useMemo(() => agents || [], [agents]);
  const editingAgent = useMemo(() => {
    if (!editAgentId) return null;
    return safeAgents.find(a => a.id === editAgentId) || null;
  }, [editAgentId, safeAgents]);

  const openChat = useCallback((id: string) => {
    setChatAgentId(id);
    setView('chat');
  }, []);

  const agent = useMemo(() => {
    if (!chatAgentId) return null;
    return safeAgents.find(a => a.id === chatAgentId) || null;
  }, [chatAgentId, safeAgents]);

  return (
    <AgentErrorBoundary onReset={() => { setView('list'); setChatAgentId(null); }}>
      <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--gia-bg)' }}>
        {view === 'list' && (
          <AgentListView
            agents={safeAgents}
            onOpenChat={openChat}
            onCreateNew={() => setShowCreate(true)}
            onEdit={(id) => setEditAgentId(id)}
            onDelete={removeAgent}
          />
        )}
        {view === 'chat' && agent && (
          <AgentErrorBoundary onReset={() => setView('list')}>
            <AgentChatView agent={agent} onBack={() => { setView('list'); setChatAgentId(null); }} />
          </AgentErrorBoundary>
        )}
        <CreateAgentModal
          isOpen={showCreate}
          editAgent={null}
          onClose={() => setShowCreate(false)}
          onSave={(agentId) => {
            setShowCreate(false);
            openChat(agentId);
          }}
        />
        {editAgentId && editingAgent && (
          <CreateAgentModal
            isOpen={true}
            editAgent={editingAgent}
            onClose={() => setEditAgentId(null)}
            onSave={() => {
              setEditAgentId(null);
            }}
          />
        )}
      </div>
    </AgentErrorBoundary>
  );
};

/* ─── List View with Layout Animations & Filtering ─────────────────────── */

const AgentListView: React.FC<{
  agents: CustomAgent[];
  onOpenChat: (id: string) => void;
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ agents, onOpenChat, onCreateNew, onEdit, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Filtered & sorted agents list
  const filteredAgents = useMemo(() => {
    let result = [...agents];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.systemPrompt && a.systemPrompt.toLowerCase().includes(q)) ||
        a.tools.some(t => t.toLowerCase().includes(q))
      );
    }

    // Category tool filter
    if (categoryFilter !== 'all') {
      const categoryToolIds = getAllAgentTools().filter(t => t.category === categoryFilter).map(t => t.id);
      result = result.filter(a => a.tools.some(t => categoryToolIds.includes(t)));
    }

    // Sort order
    result.sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'alphabetical') return a.name.localeCompare(b.name);
      if (sortBy === 'tools') return b.tools.length - a.tools.length;
      if (sortBy === 'files') return b.files.length - a.files.length;
      return 0;
    });

    return result;
  }, [agents, searchQuery, categoryFilter, sortBy]);

  const totalToolsCount = useMemo(() => {
    const unique = new Set<string>();
    agents.forEach(a => a.tools.forEach(t => unique.add(t)));
    return unique.size;
  }, [agents]);

  const totalFilesCount = useMemo(() => {
    return agents.reduce((acc, a) => acc + a.files.length, 0);
  }, [agents]);

  return (
    <div className="flex flex-col h-full overflow-hidden agent-cosmic-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>Agents</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>
            {agents.length} {agents.length === 1 ? 'custom agent' : 'custom agents'} · {totalToolsCount} tools · {totalFilesCount} files
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="w-9 h-9 rounded-xl flex items-center justify-center tap-feedback transition-transform hover:scale-105"
          style={{ background: 'var(--gia-accent)', color: 'white', boxShadow: '0 4px 14px rgba(168,85,247,0.35)' }}
        >
          <Plus size={18} />
        </button>
      </div>

      {agents.length > 0 && (
        <div className="px-4 pb-2 shrink-0 space-y-2">
          {/* Search bar & Sort Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--gia-muted-2)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter agents by name, tool, or prompt..."
                className="gia-input text-xs py-2 pl-8 pr-8 rounded-xl w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ color: 'var(--gia-muted)' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sort button dropdown toggle */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium tap-feedback border"
                style={{
                  background: sortBy !== 'newest' ? 'rgba(168,85,247,0.12)' : 'var(--gia-surface)',
                  borderColor: sortBy !== 'newest' ? 'rgba(168,85,247,0.3)' : 'var(--gia-border)',
                  color: sortBy !== 'newest' ? '#a855f7' : 'var(--gia-text)',
                }}
              >
                <ArrowUpDown size={12} />
                <span className="capitalize">{sortBy}</span>
              </button>

              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    className="absolute right-0 top-10 z-30 w-36 py-1.5 rounded-xl shadow-xl border overflow-hidden"
                    style={{ background: 'var(--gia-surface)', borderColor: 'var(--gia-border)' }}
                  >
                    {[
                      { id: 'newest', label: 'Newest First' },
                      { id: 'alphabetical', label: 'Alphabetical' },
                      { id: 'tools', label: 'Most Tools' },
                      { id: 'files', label: 'Most Files' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortBy(opt.id as SortOption);
                          setShowSortMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[11px] font-medium flex items-center justify-between hover:bg-purple-500/10 transition-colors"
                        style={{ color: sortBy === opt.id ? '#a855f7' : 'var(--gia-text)' }}
                      >
                        {opt.label}
                        {sortBy === opt.id && <Check size={12} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Filter Pills Category Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORY_FILTERS.map((cat) => {
              const active = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className="relative px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors tap-feedback shrink-0"
                  style={{
                    color: active ? '#ffffff' : 'var(--gia-muted)',
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="activeFilterPill"
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {agents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-6 pb-12">
          {/* Stable cosmic rays */}
          <div className="agent-cosmic-ray" style={{ left: '15%', animationDuration: '7s', animationDelay: '0.5s' }} />
          <div className="agent-cosmic-ray" style={{ left: '40%', animationDuration: '9s', animationDelay: '2s' }} />
          <div className="agent-cosmic-ray" style={{ left: '65%', animationDuration: '8s', animationDelay: '1s' }} />
          <div className="agent-cosmic-ray" style={{ left: '85%', animationDuration: '10s', animationDelay: '3s' }} />

          {/* Portal rings */}
          <div className="agent-portal-ring" style={{ width: 220, height: 220, top: '35%', left: '50%', marginLeft: -110, marginTop: -160 }} />
          <div className="agent-portal-ring-inner" style={{ width: 180, height: 180, top: '35%', left: '50%', marginLeft: -90, marginTop: -140 }} />

          {/* Orbiting particles */}
          {PARTICLE_CONFIGS.map((p, i) => (
            <div
              key={i}
              className="agent-particle"
              style={{
                width: p.size + 1,
                height: p.size + 1,
                top: '35%', left: '50%',
                marginTop: -1, marginLeft: -1,
                '--orbit-r': `${p.orbitR}px`,
                '--delay': `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                background: `rgba(${168 + p.colorOffset}, ${85 + p.colorOffset}, 247, ${p.alpha})`,
              } as React.CSSProperties}
            />
          ))}

          {/* Core icon */}
          <div className="agent-core-icon relative z-10 mb-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(139,92,246,0.08))', border: '1px solid rgba(168,85,247,0.12)' }}>
              <Sparkles size={36} style={{ color: 'rgba(168,85,247,0.7)' }} />
            </div>
          </div>

          <div className="relative z-10 text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--gia-text)' }}>
              <span className="agent-empty-word">Unleash</span>{' '}
              <span className="agent-empty-word">your</span>{' '}
              <span className="agent-empty-word" style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>agents</span>
            </h2>
            <p className="agent-empty-subtitle text-xs leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--gia-muted)' }}>
              Craft powerful AI agents with custom knowledge, tools, and personalities.
            </p>
          </div>

          <button onClick={onCreateNew} className="agent-empty-btn mt-8 gia-btn gia-btn-primary rounded-xl px-6 py-3 text-sm font-semibold relative z-10 flex items-center gap-2 tap-feedback" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
            <Sparkles size={14} />
            Awaken Your First Agent
          </button>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Filter size={32} style={{ color: 'var(--gia-muted-2)' }} className="mb-2" />
          <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>No matching agents found</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--gia-muted)' }}>Try clearing your search query or category filter.</p>
          <button
            onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}
            className="mt-3 text-xs px-3 py-1.5 rounded-lg font-medium tap-feedback"
            style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <motion.div
            layout
            className="grid grid-cols-1 gap-2.5"
          >
            <AnimatePresence mode="popLayout">
              {filteredAgents.map((agent) => {
                const color = getIconColor(agent.icon);
                const IconComponent = resolveAgentIcon(agent.icon);

                return (
                  <motion.div
                    key={agent.id}
                    layout
                    layoutId={`agent-card-${agent.id}`}
                    initial={{ opacity: 0, scale: 0.94, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -8, filter: 'blur(4px)' }}
                    transition={{
                      type: 'spring',
                      stiffness: 350,
                      damping: 32,
                      mass: 0.8,
                    }}
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onOpenChat(agent.id)}
                    className="gia-card p-3.5 cursor-pointer relative overflow-hidden group border transition-all"
                    style={{
                      background: 'var(--gia-surface)',
                      borderColor: 'var(--gia-border)',
                    }}
                  >
                    {/* Background Subtle Accent Glow */}
                    <div
                      className="absolute -right-12 -top-12 w-28 h-28 rounded-full pointer-events-none opacity-20 transition-opacity group-hover:opacity-40"
                      style={{
                        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                        filter: 'blur(16px)',
                      }}
                    />

                    <div className="flex items-start gap-3 relative z-10">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <OrbAvatar color={color} size={34} animate={false} icon={<IconComponent size={18} />} />
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold truncate" style={{ color: 'var(--gia-text)' }}>
                            {agent.name}
                          </h3>
                          {agent.files.length > 0 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                              <FileText size={9} />
                              {agent.files.length}
                            </span>
                          )}
                        </div>

                        {agent.description ? (
                          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--gia-muted)' }}>
                            {agent.description}
                          </p>
                        ) : (
                          <p className="text-[11px] italic truncate mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>
                            No description provided
                          </p>
                        )}

                        {/* Assigned Tools Badges */}
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          {agent.tools.slice(0, 4).map((tId) => {
                            const tDef = getAllAgentTools().find(t => t.id === tId);
                            const TIcon = tDef?.icon || Code2;
                            return (
                              <span
                                key={tId}
                                className="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-md font-medium"
                                style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}
                              >
                                <TIcon size={8} style={{ color: color }} />
                                {tDef?.label || tId}
                              </span>
                            );
                          })}
                          {agent.tools.length > 4 && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: 'rgba(168,85,247,0.08)', color: '#a855f7' }}>
                              +{agent.tools.length - 4} more
                            </span>
                          )}
                          {agent.tools.length === 0 && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-md font-medium" style={{ color: 'var(--gia-muted-2)' }}>
                              No tools
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenChat(agent.id); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center tap-feedback hover:bg-purple-500/10"
                          style={{ color: '#a855f7' }}
                          title="Open Chat"
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(agent.id); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center tap-feedback hover:bg-gray-500/10"
                          style={{ color: 'var(--gia-muted)' }}
                          title="Settings"
                        >
                          <Settings2 size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center tap-feedback hover:bg-red-500/10"
                          style={{ color: 'var(--gia-muted-2)' }}
                          title="Delete Agent"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </div>
  );
};

/* ─── Chat View ─────────────────────────────────────────── */

function buildToolSection(tools: string[]): string {
  if (!tools || tools.length === 0) return '';
  const lines = [
    '## Tools you can use',
    'Call a tool by writing a fenced code block:',
    '```tool',
    '{ "id": "tool_id_here", "args": { "param": "value" } }',
    '```',
    '',
    '| Tool | What it does |',
    '|---|---|',
  ];
  for (const t of tools) {
    const desc = TOOL_DESCRIPTIONS[t] || 'No description';
    lines.push(`| \`${t}\` | ${desc} |`);
  }
  return lines.join('\n');
}

const AgentChatView: React.FC<{
  agent: CustomAgent;
  onBack: () => void;
}> = ({ agent, onBack }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useAgentStore(s => s.chatSessions[agent.id] || []);
  const addMsg = useAgentStore(s => s.addMessage);
  const clear = useAgentStore(s => s.clearChat);

  const accumulatedRef = useRef('');
  const rafIdRef = useRef<number | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: AgentMessage = { id: genId(), role: 'user', content: text, createdAt: Date.now() };
    addMsg(agent.id, userMsg);
    setLoading(true);

    const asstId = genId();
    try {
      useGiaStore.getState().setGenerationState({ active: true, module: 'agents', sessionId: agent.id, messageId: asstId });
    } catch { /* non-critical */ }

    const asstMsg: AgentMessage = { id: asstId, role: 'assistant', content: '', createdAt: Date.now() };
    addMsg(agent.id, asstMsg);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      // RAG search — graceful fallback
      let ragResults: Awaited<ReturnType<typeof searchAgentRAG>> = [];
      let sources: AgentSource[] = [];
      if (agent.files && agent.files.length > 0) {
        try {
          ragResults = await searchAgentRAG(agent.id, text, 8);
          sources = ragResults.map(r => ({ fileName: r.title, score: r.score, excerpt: r.text.slice(0, 200) }));
        } catch (ragErr) {
          console.warn('[AgentChat] RAG search failed, continuing without context:', ragErr);
        }
      }

      const fileContext = ragResults.length > 0
        ? `\n\n## Knowledge files\nRelevant passages from the user's knowledge files. Cite the specific file name when you use information from it.\n\n${ragResults.map((r, i) => `[Source ${i + 1}: ${r.title}]\n${r.text.slice(0, 600)}`).join('\n\n')}`
        : '';

      const toolSection = buildToolSection(agent.tools || []);

      const systemPrompt = `${agent.systemPrompt}

You are "${agent.name}" — embody this persona fully.
${agent.description ? `Your purpose: ${agent.description}` : ''}

## Your knowledge files
${agent.files && agent.files.length > 0
  ? `You have access to ${agent.files.length} knowledge file(s). Answer from these files when relevant. When you use information from a file, name it.`
  : 'No knowledge files uploaded.'}

${toolSection}

## Rules
- You ONLY have the tools listed above. Do not use tools not in your list.
- Your knowledge files are always available. Draw from them freely.
- Be thorough and direct. No unnecessary restrictions.
- Format your responses beautifully: use headings, code blocks, bullet lists, bold text as appropriate.${fileContext}`;

      accumulatedRef.current = '';

      const res = await GiaBrain.generate({
        prompt: text,
        history,
        systemPrompt,
        systemPromptMode: 'replace',
        temperature: 0.8,
        onStream: (chunk) => {
          accumulatedRef.current += chunk;

          // Throttled UI state updates via requestAnimationFrame to avoid frame drops
          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
              rafIdRef.current = null;
              const currentContent = accumulatedRef.current;
              useAgentStore.setState(s => ({
                chatSessions: {
                  ...s.chatSessions,
                  [agent.id]: (s.chatSessions[agent.id] || []).map(m =>
                    m.id === asstId ? { ...m, content: currentContent } : m
                  ),
                },
              }));
            });
          }
        },
      });

      const finalContent = accumulatedRef.current || res.text;

      useAgentStore.setState(s => {
        const session = (s.chatSessions[agent.id] || []).map(m =>
          m.id === asstId ? { ...m, content: finalContent, sources } : m
        );
        const capped = session.length > MAX_MESSAGES_PER_SESSION
          ? session.slice(session.length - MAX_MESSAGES_PER_SESSION)
          : session;
        return {
          chatSessions: {
            ...s.chatSessions,
            [agent.id]: capped,
          },
        };
      });
    } catch (e) {
      useAgentStore.setState(s => ({
        chatSessions: {
          ...s.chatSessions,
          [agent.id]: (s.chatSessions[agent.id] || []).map(m =>
            m.id === asstId ? { ...m, content: `⚠️ Error: ${e instanceof Error ? e.message : 'Request failed. Check your provider settings.'}` } : m
          ),
        },
      }));
    } finally {
      setLoading(false);
      try {
        useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      } catch { /* non-critical */ }

      // Background notification
      (async () => {
        try {
          const { default: DesktopNotifications } = await import('../services/DesktopNotifications');
          if (useGiaStore.getState().currentModule !== 'agents') {
            DesktopNotifications.notify(`${agent.name} Responded`, {
              body: 'Your agent has finished generating a response.',
              tag: `gia-agents-${asstId}`,
            });
          }
        } catch { /* not critical */ }
      })();
    }
  };

  const color = getIconColor(agent.icon);
  const IconComponent = resolveAgentIcon(agent.icon);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <button onClick={onBack} className="w-7 h-7 rounded-lg flex items-center justify-center tap-feedback" style={{ color: 'var(--gia-muted)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
          <OrbAvatar color={color} size={26} animate={false} icon={<IconComponent size={14} />} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{agent.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {agent.tools && agent.tools.length > 0 && (
              <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>{agent.tools.length} tools</span>
            )}
            {agent.files && agent.files.length > 0 && (
              <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>{agent.files.length} files</span>
            )}
          </div>
        </div>
        <button onClick={() => clear(agent.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] tap-feedback"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>
          <Trash2 size={10} /> Clear
        </button>
      </div>

      {/* Files strip */}
      {agent.files && agent.files.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto shrink-0" style={{ background: 'var(--gia-surface)', borderBottom: '1px solid var(--gia-border)' }}>
          <FileText size={11} style={{ color: 'var(--gia-muted-2)' }} />
          {agent.files.map(f => (
            <span key={f.id} className="text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(168,85,247,0.06)', color: 'var(--gia-muted)', border: '1px solid rgba(168,85,247,0.1)' }}>
              {f.name}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${color}08` }}>
              <OrbAvatar color={color} size={46} animate glow={false} icon={<IconComponent size={22} />} />
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--gia-muted)' }}>Ask {agent.name} anything</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
              {agent.tools && agent.tools.length > 0 ? `${agent.tools.length} tool(s) available` : 'No tools assigned'}
              {agent.files && agent.files.length > 0 ? ` · ${agent.files.length} file(s)` : ''}
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isLatestAssistant = msg.role === 'assistant' && idx === messages.length - 1 && loading;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] ${msg.role === 'user' ? 'msg-user px-3.5 py-2.5 text-[13px] leading-relaxed' : 'msg-assistant px-3.5 py-2.5'}`}
                  style={isLatestAssistant ? { boxShadow: '0 0 20px rgba(168,85,247,0.08)' } : {}}
                >
                  {msg.role === 'user' ? (
                    msg.content || null
                  ) : msg.content ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <span className="flex items-center gap-1.5 py-1">
                      <span className="agent-thinking-dot w-[5px] h-[5px] rounded-full" style={{ background: 'var(--gia-accent)' }} />
                      <span className="agent-thinking-dot w-[5px] h-[5px] rounded-full" style={{ background: 'var(--gia-accent)' }} />
                      <span className="agent-thinking-dot w-[5px] h-[5px] rounded-full" style={{ background: 'var(--gia-accent)' }} />
                    </span>
                  )}
                </div>

                {/* Source chips */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && msg.content && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[85%]">
                    {msg.sources.filter(s => s.score > 0.3).map((s, i) => (
                      <div
                        key={i}
                        className="agent-source-chip group relative flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] cursor-default"
                        style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.08)' }}
                      >
                        <FileText size={9} style={{ color: color }} />
                        <span style={{ color: 'var(--gia-muted)' }}>{s.fileName}</span>
                        <span className="text-[7px] font-mono" style={{ color: s.score > 0.7 ? '#34d399' : s.score > 0.5 ? '#f59e0b' : '#71717a' }}>
                          {(s.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid var(--gia-border)' }}>
        <div className="flex items-end gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${agent.name}...`}
            disabled={loading}
            className="flex-1 gia-input text-[13px] py-2.5 px-3.5 rounded-xl"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 tap-feedback"
            style={{ background: loading || !input.trim() ? 'var(--gia-surface-2)' : 'var(--gia-accent)', color: loading || !input.trim() ? 'var(--gia-muted-2)' : 'white' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Create / Edit Modal ────────────────────────────────── */

const CreateAgentModal: React.FC<{
  isOpen: boolean;
  editAgent: CustomAgent | null;
  onClose: () => void;
  onSave: (agentId: string) => void;
}> = ({ isOpen, editAgent, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompt);
  const [icon, setIcon] = useState('Bot');
  const [tools, setTools] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(editAgent?.name || '');
      setDescription(editAgent?.description || '');
      setSystemPrompt(editAgent?.systemPrompt || defaultPrompt);
      setIcon(editAgent?.icon || 'Bot');
      setTools(editAgent?.tools || []);
      setFiles([]);
    }
  }, [isOpen, editAgent]);

  if (!isOpen) return null;

  const isEditing = Boolean(editAgent);

  const handleSave = async () => {
    if (!name.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadComplete(false);
    try {
      if (isEditing && editAgent) {
        useAgentStore.getState().updateAgent(editAgent.id, {
          name: name.trim(),
          description: description.trim(),
          systemPrompt,
          icon,
          tools,
        });
        const total = files.length;
        for (let i = 0; i < total; i++) {
          const file = files[i];
          try {
            // Each file owns a slice of the progress bar; the chunk callback
            // reports REAL indexing progress instead of a fake timer, so
            // "Uploading… 85%" actually reflects embedding work done.
            const startPct = Math.round((i / total) * 80) + 10;
            const endPct = Math.round(((i + 1) / total) * 80) + 10;
            await useAgentStore.getState().addFileToAgent(editAgent.id, file, (done, totalChunks) => {
              const frac = totalChunks > 0 ? done / totalChunks : 1;
              setUploadProgress(Math.min(startPct + frac * (endPct - startPct), endPct));
            });
            setUploadProgress(endPct);
          } catch (e) { console.error('Upload failed:', file.name, e); }
        }
        setUploadProgress(100);
        setUploadComplete(true);
        setTimeout(() => setUploadComplete(false), 2000);
        onSave(editAgent.id);
      } else {
        const agent = useAgentStore.getState().addAgent({
          name: name.trim(),
          description: description.trim(),
          systemPrompt,
          icon,
          tools,
        });
        const total = files.length;
        for (let i = 0; i < total; i++) {
          const file = files[i];
          try {
            const startPct = Math.round((i / total) * 80) + 10;
            const endPct = Math.round(((i + 1) / total) * 80) + 10;
            await useAgentStore.getState().addFileToAgent(agent.id, file, (done, totalChunks) => {
              const frac = totalChunks > 0 ? done / totalChunks : 1;
              setUploadProgress(Math.min(startPct + frac * (endPct - startPct), endPct));
            });
            setUploadProgress(endPct);
          } catch (e) { console.error('Upload failed:', file.name, e); }
        }
        setUploadProgress(100);
        setUploadComplete(true);
        setTimeout(() => setUploadComplete(false), 2000);
        onSave(agent.id);
      }
    } catch (e) {
      console.error('[CreateAgentModal] Save failed:', e);
    } finally {
      setUploading(false);
    }
  };

  const currentIconColor = getIconColor(icon);
  const CurrentIconComponent = resolveAgentIcon(icon);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--gia-border)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--gia-text)' }}>{isEditing ? 'Edit Agent' : 'Create Agent'}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--gia-muted)' }}><X size={14} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Icon picker */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Avatar Icon</label>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${currentIconColor}15` }}>
                <OrbAvatar color={currentIconColor} size={34} animate glow={false} icon={<CurrentIconComponent size={18} />} />
              </div>
              <div className="flex-1 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {AGENT_ICONS.map(a => {
                  const AIcon = resolveAgentIcon(a.name);
                  return (
                    <button key={a.name} onClick={() => setIcon(a.name)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center tap-feedback"
                      style={{ background: icon === a.name ? `${a.color}20` : 'var(--gia-surface-2)', border: icon === a.name ? `1px solid ${a.color}40` : '1px solid var(--gia-border)' }}>
                      <OrbAvatar color={a.color} size={16} animate={false} glow={icon === a.name} icon={<AIcon size={10} />} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Code Specialist" className="gia-input mt-1.5 text-[13px]" />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this agent do?" className="gia-input mt-1.5 text-[13px]" />
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>System Prompt</label>
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={5}
              className="gia-input mt-1.5 text-[11px] font-mono resize-none" style={{ minHeight: '80px' }} />
          </div>

          {/* Tool selection — every registered tool, grouped by category */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>
              Tools <span className="text-[8px] font-normal lowercase" style={{ color: 'var(--gia-muted-2)' }}>({getAllAgentTools().length} registered — select capabilities)</span>
            </label>
            {(() => {
              const grouped = getAllAgentTools().reduce<Record<string, { id: string; label: string; icon: LucideIcon; description: string; category: string }[]>>((acc, t) => {
                (acc[t.category] ||= []).push(t);
                return acc;
              }, {});
              return Object.entries(grouped).map(([cat, list]) => (
                <div key={cat} className="mt-2">
                  <p className="text-[8px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--gia-muted-2)' }}>
                    {CATEGORY_FILTERS.find(c => c.id === cat)?.label || cat} · {list.length}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {list.map(t => {
                      const T = t.icon;
                      const active = tools.includes(t.id);
                      return (
                        <button key={t.id} onClick={() => setTools(prev => active ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] text-left tap-feedback transition-all"
                          style={{ background: active ? `${currentIconColor}10` : 'var(--gia-surface-2)', border: active ? `1px solid ${currentIconColor}30` : '1px solid var(--gia-border)' }}>
                          <T size={12} style={{ color: active ? currentIconColor : 'var(--gia-muted-2)' }} />
                          <div className="flex-1 min-w-0">
                            <span className="block font-medium truncate" style={{ color: active ? 'var(--gia-text)' : 'var(--gia-muted)' }}>{t.label}</span>
                            <span className="block text-[8px] truncate" style={{ color: 'var(--gia-muted-2)' }}>{t.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* File upload */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Knowledge Files</label>

            {isEditing && editAgent && editAgent.files && editAgent.files.length > 0 && (
              <div className="mt-1.5 space-y-1 mb-2">
                {editAgent.files.map(f => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px]" style={{ background: 'var(--gia-surface-2)' }}>
                    <FileText size={12} style={{ color: 'var(--gia-muted)' }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--gia-text)' }}>{f.name}</span>
                    <button onClick={() => useAgentStore.getState().removeFileFromAgent(editAgent.id, f.id)} style={{ color: 'var(--gia-muted-2)' }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}

            <div onClick={() => fileRef.current?.click()}
              className="mt-1.5 border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer tap-feedback"
              style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-muted-2)' }}>
              <Upload size={16} className="text-violet-500/60" />
              <p className="text-[11px] font-medium" style={{ color: 'var(--gia-muted)' }}>{isEditing ? 'Add more files' : 'Drop files or click to upload'}</p>
              <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>TXT, PDF, MD, CSV, JSON</p>
            </div>
            <input ref={fileRef} type="file" multiple accept=".txt,.md,.pdf,.csv,.json,.html"
              onChange={(e) => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} className="hidden" />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px]" style={{ background: 'var(--gia-surface-2)' }}>
                    <FileText size={12} style={{ color: 'var(--gia-muted)' }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--gia-text)' }}>{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ color: 'var(--gia-muted-2)' }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Loader2 size={11} className="animate-spin shrink-0" style={{ color: '#a855f7' }} />
              <span className="text-[10px] font-medium" style={{ color: 'var(--gia-muted)' }}>Uploading files... {uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--gia-surface-2)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #a855f7, #c084fc)' }}
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
        {uploadComplete && (
          <div className="px-5 py-3 flex items-center gap-2">
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[10px] font-medium" style={{ color: '#34d399' }}>Upload complete</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--gia-border)' }}>
          <button onClick={onClose} className="flex-1 gia-btn gia-btn-ghost text-xs py-2.5">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || uploading}
            className="flex-1 gia-btn gia-btn-primary text-xs py-2.5 flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 size={13} className="animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Agent'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const defaultPrompt = `You are a specialized agent built for a specific purpose.

## Core identity
- You have specific tools and knowledge files assigned by your creator
- Your job is to use those tools and files to deliver precise, high-quality results
- No unnecessary restrictions — get the job done

## How you respond
- Be thorough and direct
- When you use information from your knowledge files, name the file
- Use your tools when they add value
- Format beautifully — headings, lists, bold text, code blocks`;

export default AgentsModule;
