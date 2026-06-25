import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, X, Trash2, Upload, FileText,
  ChevronLeft, Send, Loader2, Bot, Sparkles, Settings2,
  Code2, Brain, Wand2, Star, Rocket, Zap, Globe, BookOpen,
  GraduationCap, Palette, Music, Camera, PenLine, BarChart2,
  Search, Target, Shield, Compass, Cpu, Database, Image,
  Mic, MessageCircle, Eye, Feather, Lightbulb, Cloud,
  Download, Share2, Link, Hash, Flag, Award, Gem, Crown,
  Flame, Sun, Moon, Wind, Leaf, Folder, type LucideIcon,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAgentStore, type CustomAgent, type AgentMessage, type AgentSource, searchAgentRAG } from '../store/useAgentStore';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { genId } from '../utils/id';

type ViewState = 'list' | 'chat';

const AGENT_ICONS: { name: string; icon: LucideIcon; color: string }[] = [
  { name: 'Bot', icon: Bot, color: '#a855f7' },
  { name: 'Brain', icon: Brain, color: '#ec4899' },
  { name: 'Code2', icon: Code2, color: '#3b82f6' },
  { name: 'Wand2', icon: Wand2, color: '#f59e0b' },
  { name: 'Sparkles', icon: Sparkles, color: '#fbbf24' },
  { name: 'Star', icon: Star, color: '#fbbf24' },
  { name: 'Rocket', icon: Rocket, color: '#ef4444' },
  { name: 'Zap', icon: Zap, color: '#f59e0b' },
  { name: 'Globe', icon: Globe, color: '#34d399' },
  { name: 'BookOpen', icon: BookOpen, color: '#6366f1' },
  { name: 'GraduationCap', icon: GraduationCap, color: '#f59e0b' },
  { name: 'Palette', icon: Palette, color: '#ec4899' },
  { name: 'PenLine', icon: PenLine, color: '#06b6d4' },
  { name: 'BarChart2', icon: BarChart2, color: '#3b82f6' },
  { name: 'Search', icon: Search, color: '#8b5cf6' },
  { name: 'Target', icon: Target, color: '#ef4444' },
  { name: 'Shield', icon: Shield, color: '#34d399' },
  { name: 'Compass', icon: Compass, color: '#10b981' },
  { name: 'Cpu', icon: Cpu, color: '#a855f7' },
  { name: 'Database', icon: Database, color: '#6366f1' },
  { name: 'Lightbulb', icon: Lightbulb, color: '#fbbf24' },
  { name: 'Cloud', icon: Cloud, color: '#3b82f6' },
  { name: 'Gem', icon: Gem, color: '#ec4899' },
  { name: 'Crown', icon: Crown, color: '#f59e0b' },
  { name: 'Flame', icon: Flame, color: '#ef4444' },
  { name: 'Feather', icon: Feather, color: '#a855f7' },
  { name: 'Mic', icon: Mic, color: '#06b6d4' },
  { name: 'MessageCircle', icon: MessageCircle, color: '#34d399' },
  { name: 'Image', icon: Image, color: '#8b5cf6' },
  { name: 'Music', icon: Music, color: '#ec4899' },
  { name: 'Camera', icon: Camera, color: '#6366f1' },
  { name: 'Eye', icon: Eye, color: '#10b981' },
  { name: 'Share2', icon: Share2, color: '#3b82f6' },
  { name: 'Link', icon: Link, color: '#a855f7' },
  { name: 'Award', icon: Award, color: '#f59e0b' },
  { name: 'Sun', icon: Sun, color: '#fbbf24' },
  { name: 'Moon', icon: Moon, color: '#6366f1' },
  { name: 'Wind', icon: Wind, color: '#34d399' },
  { name: 'Leaf', icon: Leaf, color: '#10b981' },
  { name: 'Download', icon: Download, color: '#3b82f6' },
  { name: 'Hash', icon: Hash, color: '#a855f7' },
  { name: 'Flag', icon: Flag, color: '#ef4444' },
];

const AVAILABLE_TOOLS: { id: string; label: string; icon: LucideIcon; description: string }[] = [
  { id: 'web_search', label: 'Web Search', icon: Search, description: 'Search the web for current information' },
  { id: 'read_url', label: 'Read URL', icon: Globe, description: 'Extract content from any web page' },
  { id: 'terminal_run', label: 'Code Execution', icon: Code2, description: 'Run code (Python, JS, bash) in sandbox' },
  { id: 'filesystem_read', label: 'Read Files', icon: FileText, description: 'Read files from device' },
  { id: 'filesystem_write', label: 'Write Files', icon: PenLine, description: 'Save files to device' },
  { id: 'filesystem_desktop_read', label: 'Desktop Read', icon: Folder, description: 'Read from project folder' },
  { id: 'filesystem_desktop_write', label: 'Desktop Write', icon: Folder, description: 'Write to project folder' },
  { id: 'image_generation', label: 'Image Gen', icon: Image, description: 'Generate images from prompts' },
  { id: 'browser_navigate', label: 'Browser', icon: Compass, description: 'Full JS-rendered web pages' },
  { id: 'get_user_location', label: 'Location', icon: Target, description: 'Get GPS location' },
  { id: 'weather', label: 'Weather', icon: Cloud, description: 'Current weather for any city' },
  { id: 'wikipedia', label: 'Wikipedia', icon: BookOpen, description: 'Wikipedia article summaries' },
  { id: 'github', label: 'GitHub', icon: Code2, description: 'GitHub user/repo/file data' },
  { id: 'save_memory', label: 'Memory', icon: Brain, description: 'Save and recall facts' },
  { id: 'clipboard', label: 'Clipboard', icon: FileText, description: 'Read/write system clipboard' },
  { id: 'device_info', label: 'Device Info', icon: Cpu, description: 'Device battery, OS, network info' },
];

function getIconComponent(name: string): LucideIcon {
  return AGENT_ICONS.find(i => i.name === name)?.icon || Bot;
}

function getIconColor(name: string): string {
  return AGENT_ICONS.find(i => i.name === name)?.color || '#a855f7';
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  web_search: 'Search the web for current information',
  read_url: 'Extract clean content from any URL',
  terminal_run: 'Execute code (Python, JavaScript, bash) in an isolated sandbox',
  filesystem_read: 'Read a file from the device by path',
  filesystem_write: 'Write or save a file to the device',
  filesystem_desktop_read: 'Read a file from the user\'s project folder (desktop only)',
  filesystem_desktop_write: 'Write a file to the user\'s project folder (desktop only)',
  filesystem_desktop_list: 'List files in the project folder',
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

const AgentsModule: React.FC = () => {
  const { agents, updateAgent, removeAgent } = useAgentStore(useShallow(s => ({
    agents: s.agents,
    updateAgent: s.updateAgent,
    removeAgent: s.removeAgent,
  })));

  const [view, setView] = useState<ViewState>('list');
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editAgentId, setEditAgentId] = useState<string | null>(null);

  const safeAgents = agents ?? [];
  const editingAgent = editAgentId ? safeAgents.find(a => a.id === editAgentId) ?? null : null;

  const openChat = (id: string) => { setChatAgentId(id); setView('chat'); };
  const agent = chatAgentId ? safeAgents.find(a => a.id === chatAgentId) ?? null : null;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
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
        <AgentChatView agent={agent} onBack={() => { setView('list'); setChatAgentId(null); }} />
      )}
      <CreateAgentModal
        isOpen={showCreate}
        editAgent={null}
        onClose={() => setShowCreate(false)}
        onSave={(input) => {
          const created = useAgentStore.getState().addAgent(input);
          setShowCreate(false);
          openChat(created.id);
        }}
      />
      <CreateAgentModal
        isOpen={editAgentId !== null}
        editAgent={editingAgent}
        onClose={() => setEditAgentId(null)}
        onSave={(input) => {
          if (editingAgent) {
            updateAgent(editingAgent.id, input);
            setEditAgentId(null);
          }
        }}
      />
    </div>
  );
};

/* ─── List View ─────────────────────────────────────────── */

const AgentListView: React.FC<{
  agents: CustomAgent[];
  onOpenChat: (id: string) => void;
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ agents, onOpenChat, onCreateNew, onEdit, onDelete }) => (
  <div className="flex flex-col h-full overflow-hidden agent-cosmic-bg">
    <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0" style={{ background: agents.length > 0 ? undefined : 'transparent' }}>
      <div>
        <h1 className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>Agents</h1>
        {agents.length > 0 && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>
            {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
          </p>
        )}
      </div>
      <button onClick={onCreateNew} className="w-9 h-9 rounded-xl flex items-center justify-center tap-feedback" style={{ background: 'var(--gia-accent)', color: 'white' }}>
        <Plus size={16} />
      </button>
    </div>

    {agents.length === 0 ? (
      /* ─── Cosmic Portal Empty State ─── */
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-6 pb-12">
        {/* Cosmic rays */}
        <div className="agent-cosmic-ray" style={{ left: '15%', animationDuration: '7s', animationDelay: '0.5s' }} />
        <div className="agent-cosmic-ray" style={{ left: '40%', animationDuration: '9s', animationDelay: '2s' }} />
        <div className="agent-cosmic-ray" style={{ left: '65%', animationDuration: '8s', animationDelay: '1s' }} />
        <div className="agent-cosmic-ray" style={{ left: '85%', animationDuration: '10s', animationDelay: '3s' }} />

        {/* Portal rings */}
        <div className="agent-portal-ring" style={{ width: 220, height: 220, top: '35%', left: '50%', marginLeft: -110, marginTop: -160 }} />
        <div className="agent-portal-ring-inner" style={{ width: 180, height: 180, top: '35%', left: '50%', marginLeft: -90, marginTop: -140 }} />
        <div className="agent-portal-ring" style={{ width: 140, height: 140, top: '35%', left: '50%', marginLeft: -70, marginTop: -120, animationDuration: '15s', borderWidth: 2, borderColor: 'rgba(168,85,247,0.04)' }} />

        {/* Orbiting particles */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="agent-particle" style={{
            width: Math.random() * 2 + 1,
            height: Math.random() * 2 + 1,
            top: '35%', left: '50%',
            marginTop: -1, marginLeft: -1,
            '--orbit-r': `${50 + Math.random() * 70}px`,
            '--delay': `${Math.random() * 3}s`,
            animationDuration: `${4 + Math.random() * 4}s`,
            background: `rgba(${168 + Math.random() * 40}, ${85 + Math.random() * 40}, 247, ${0.3 + Math.random() * 0.4})`,
          } as React.CSSProperties} />
        ))}

        {/* Floating geometric shapes */}
        <div className="agent-shape" style={{ top: '15%', left: '20%', '--dx': '80px', '--dy': '60px', '--dr': '360deg', '--duration': '14s', '--delay': '0.5s' } as React.CSSProperties}>
          <div className="w-4 h-4 border border-violet-500/10 rounded" style={{ transform: 'rotate(45deg)' }} />
        </div>
        <div className="agent-shape" style={{ top: '25%', right: '20%', '--dx': '-60px', '--dy': '80px', '--dr': '-270deg', '--duration': '16s', '--delay': '1.5s' } as React.CSSProperties}>
          <div className="w-3 h-3 border border-purple-400/10 rounded-full" />
        </div>
        <div className="agent-shape" style={{ bottom: '30%', left: '15%', '--dx': '100px', '--dy': '-50px', '--dr': '180deg', '--duration': '12s', '--delay': '2.5s' } as React.CSSProperties}>
          <div className="w-5 h-0.5 bg-violet-400/10 rounded-full" />
        </div>
        <div className="agent-shape" style={{ bottom: '25%', right: '15%', '--dx': '-70px', '--dy': '-90px', '--dr': '450deg', '--duration': '18s', '--delay': '0.8s' } as React.CSSProperties}>
          <div className="w-[10px] h-[10px] border border-fuchsia-400/10" style={{ transform: 'rotate(30deg) skewX(-10deg)' }} />
        </div>

        {/* Core icon with glow */}
        <div className="agent-core-icon relative z-10 mb-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(139,92,246,0.08))', border: '1px solid rgba(168,85,247,0.12)' }}>
            <Sparkles size={36} style={{ color: 'rgba(168,85,247,0.7)' }} />
          </div>
        </div>

        {/* Animated headline */}
        <div className="relative z-10 text-center">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--gia-text)' }}>
            <span className="agent-empty-word">Unleash</span>{' '}
            <span className="agent-empty-word">your</span>{' '}
            <span className="agent-empty-word" style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>agents</span>
          </h2>
          <p className="agent-empty-subtitle text-xs leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--gia-muted)' }}>
            Craft powerful AI agents with custom knowledge, tools, and personalities. Your digital army awaits.
          </p>
        </div>

        {/* Create button */}
        <button onClick={onCreateNew} className="agent-empty-btn mt-8 gia-btn gia-btn-primary rounded-xl px-6 py-3 text-sm font-semibold relative z-10 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
          <Sparkles size={14} />
          Awaken Your First Agent
        </button>
      </div>
    ) : (
      /* ─── Agent Cards ─── */
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
        <AnimatePresence mode="popLayout">
        {agents.map((agent, i) => {
          const IconComp = getIconComponent(agent.icon);
          return (
            <motion.div
              key={agent.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, filter: 'blur(4px)' }}
              transition={{
                duration: 0.35,
                delay: i * 0.05,
                ease: [0.16, 1, 0.3, 1],
                layout: { type: 'spring', stiffness: 300, damping: 30 },
              }}
              whileTap={{ scale: 0.98 }}
              className="gia-card p-4 cursor-pointer"
              onClick={() => onOpenChat(agent.id)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${getIconColor(agent.icon)}15` }}>
                  <IconComp size={18} style={{ color: getIconColor(agent.icon) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{agent.name}</h3>
                    {agent.files.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>{agent.files.length}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {agent.description && (
                      <p className="text-[11px] truncate" style={{ color: 'var(--gia-muted)' }}>{agent.description}</p>
                    )}
                    <span className="text-[8px] px-1 py-0.5 rounded shrink-0" style={{ background: 'rgba(168,85,247,0.05)', color: 'var(--gia-muted-2)' }}>
                      {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); onEdit(agent.id); }} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--gia-muted-2)' }}>
                    <Settings2 size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--gia-muted-2)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  )}
</div>
);

/* ─── Chat View ─────────────────────────────────────────── */

function buildToolSection(tools: string[]): string {
  if (tools.length === 0) return '';
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

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: AgentMessage = { id: genId(), role: 'user', content: text, createdAt: Date.now() };
    addMsg(agent.id, userMsg);
    setLoading(true);

    const asstId = genId();
    useGiaStore.getState().setGenerationState({ active: true, module: 'agents', sessionId: agent.id, messageId: asstId });
    const asstMsg: AgentMessage = { id: asstId, role: 'assistant', content: '', createdAt: Date.now() };
    addMsg(agent.id, asstMsg);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const ragResults = agent.files.length > 0
        ? await searchAgentRAG(agent.id, text, 8)
        : [];

      const sources: AgentSource[] = ragResults.map(r => ({ fileName: r.title, score: r.score, excerpt: r.text.slice(0, 200) }));

      const fileContext = ragResults.length > 0
        ? `\n\n## Knowledge files\nRelevant passages from the user's knowledge files. Cite the specific file name when you use information from it.\n\n${ragResults.map((r, i) => `[Source ${i + 1}: ${r.title}]\n${r.text.slice(0, 600)}`).join('\n\n')}`
        : '';

      const toolSection = buildToolSection(agent.tools);

      const systemPrompt = `${agent.systemPrompt}

You are "${agent.name}" — embody this persona fully.
${agent.description ? `Your purpose: ${agent.description}` : ''}

## Your knowledge files
${agent.files.length > 0
  ? `You have access to ${agent.files.length} knowledge file(s). Answer from these files when relevant. When you use information from a file, name it.`
  : 'No knowledge files uploaded.'}

${toolSection}

## Rules
- You ONLY have the tools listed above. Do not use tools not in your list.
- Your knowledge files are always available. Draw from them freely.
- Be thorough and direct. No unnecessary restrictions.${fileContext}`;

      let accumulated = '';
      const res = await GiaBrain.generate({
        prompt: text,
        history,
        systemPrompt,
        systemPromptMode: 'replace',
        temperature: 0.8,
        onStream: (chunk) => {
          accumulated += chunk;
          useAgentStore.setState(s => ({
            chatSessions: {
              ...s.chatSessions,
              [agent.id]: (s.chatSessions[agent.id] || []).map(m =>
                m.id === asstId ? { ...m, content: accumulated } : m
              ),
            },
          }));
        },
      });

      const finalContent = accumulated || res.text;
      useAgentStore.setState(s => ({
        chatSessions: {
          ...s.chatSessions,
          [agent.id]: (s.chatSessions[agent.id] || []).map(m =>
            m.id === asstId ? { ...m, content: finalContent, sources } : m
          ),
        },
      }));
    } catch (e) {
      useAgentStore.setState(s => ({
        chatSessions: {
          ...s.chatSessions,
          [agent.id]: (s.chatSessions[agent.id] || []).map(m =>
            m.id === asstId ? { ...m, content: `Error: ${e instanceof Error ? e.message : 'Request failed'}` } : m
          ),
        },
      }));
    } finally {
      setLoading(false);
      useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      // Notify if user left the agents module during generation
      (async () => {
        try {
          const { default: DesktopNotifications } = await import('../services/DesktopNotifications');
          const state = useGiaStore.getState();
          if (state.currentModule !== 'agents') {
            DesktopNotifications.notify(`${agent.name} Responded`, {
              body: 'Your agent has finished generating a response.',
              tag: `gia-agents-${asstId}`,
            });
          }
        } catch { /* not critical */ }
      })();
    }
  };

  const IconComp = getIconComponent(agent.icon);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <button onClick={onBack} className="w-7 h-7 rounded-lg flex items-center justify-center tap-feedback" style={{ color: 'var(--gia-muted)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${getIconColor(agent.icon)}15` }}>
          <IconComp size={16} style={{ color: getIconColor(agent.icon) }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{agent.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            {agent.tools.length > 0 && (
              <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>{agent.tools.length} tools</span>
            )}
            {agent.files.length > 0 && (
              <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>{agent.files.length} files</span>
            )}
          </div>
        </div>
        <button onClick={() => clear(agent.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] tap-feedback"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>
          <Trash2 size={10} /> Clear
        </button>
      </div>

      {agent.files.length > 0 && (
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${getIconColor(agent.icon)}08` }}>
              <IconComp size={26} style={{ color: `${getIconColor(agent.icon)}80` }} />
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--gia-muted)' }}>Ask {agent.name} anything</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
              {agent.tools.length > 0 ? `${agent.tools.length} tool(s) available` : 'No tools assigned'}
              {agent.files.length > 0 ? ` · ${agent.files.length} file(s)` : ''}
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
                transition={{ duration: 0.3, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} agent-message-enter`}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed ${msg.role === 'user' ? 'msg-user' : 'msg-assistant'}`}
                  style={isLatestAssistant ? { boxShadow: '0 0 20px rgba(168,85,247,0.08)' } : {}}
                >
                  {msg.content || (msg.role === 'assistant' && (
                    <span className="flex items-center gap-1.5">
                      <span className="agent-thinking-dot w-[5px] h-[5px] rounded-full" style={{ background: 'var(--gia-accent)' }} />
                      <span className="agent-thinking-dot w-[5px] h-[5px] rounded-full" style={{ background: 'var(--gia-accent)' }} />
                      <span className="agent-thinking-dot w-[5px] h-[5px] rounded-full" style={{ background: 'var(--gia-accent)' }} />
                    </span>
                  ))}
                  {isLatestAssistant && msg.content && (
                    <span className="inline" style={{ animation: 'text-reveal 0.25s ease-out both' }} />
                  )}
                </div>

                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && msg.content && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[85%]">
                    {msg.sources.filter(s => s.score > 0.3).map((s, i) => (
                      <div
                        key={i}
                        className="agent-source-chip group relative flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] cursor-default"
                        style={{
                          background: 'rgba(168,85,247,0.04)',
                          border: '1px solid rgba(168,85,247,0.08)',
                          animationDelay: `${0.15 + i * 0.08}s`,
                        }}
                      >
                        <FileText size={9} style={{ color: getIconColor(agent.icon) }} />
                        <span style={{ color: 'var(--gia-muted)' }}>{s.fileName}</span>
                        <span className="text-[7px] font-mono" style={{ color: s.score > 0.7 ? '#34d399' : s.score > 0.5 ? '#f59e0b' : '#71717a' }}>
                          {(s.score * 100).toFixed(0)}%
                        </span>
                        <div className="tooltip-content absolute bottom-full left-0 mb-1.5 w-64 p-2.5 rounded-lg text-[10px] leading-relaxed z-10"
                          style={{ background: '#18181f', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gia-muted)' }}>
                          <p className="font-semibold text-[9px] mb-1" style={{ color: 'var(--gia-text)' }}>{s.fileName}</p>
                          <p>{s.excerpt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid var(--gia-border)' }}>
        <div className="flex items-end gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${agent.name}...`} disabled={loading}
            className="flex-1 gia-input text-[13px] py-2.5 px-3.5 rounded-xl" />
          <button onClick={handleSend} disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 tap-feedback"
            style={{ background: loading || !input.trim() ? 'var(--gia-surface-2)' : 'var(--gia-accent)', color: loading || !input.trim() ? 'var(--gia-muted-2)' : 'white' }}>
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
  onSave: (input: { name: string; description: string; systemPrompt: string; icon: string; tools: string[] }) => void;
}> = ({ isOpen, editAgent, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompt);
  const [icon, setIcon] = useState('Bot');
  const [tools, setTools] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
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

  const isEditing = editAgent !== null;
  const IconPreview = getIconComponent(icon);

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
        style={{
          background: 'var(--gia-surface)',
          border: '1px solid var(--gia-border)',
          boxShadow: `0 25px 50px rgba(0,0,0,0.25), 0 0 0 1px ${getIconColor(icon)}10`,
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--gia-border)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--gia-text)' }}>{isEditing ? 'Edit Agent' : 'Create Agent'}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--gia-muted)' }}><X size={14} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Icon picker */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Avatar</label>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${getIconColor(icon)}15` }}>
                <IconPreview size={20} style={{ color: getIconColor(icon) }} />
              </div>
              <div className="flex-1 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {AGENT_ICONS.map(a => {
                  const I = a.icon;
                  return (
                    <button key={a.name} onClick={() => setIcon(a.name)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center tap-feedback"
                      style={{ background: icon === a.name ? `${a.color}20` : 'var(--gia-surface-2)', border: icon === a.name ? `1px solid ${a.color}40` : '1px solid var(--gia-border)' }}>
                      <I size={14} style={{ color: icon === a.name ? a.color : 'var(--gia-muted)' }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Name */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Code Specialist" className="gia-input mt-1.5 text-[13px]" />
          </motion.div>

          {/* Description */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this agent do?" className="gia-input mt-1.5 text-[13px]" />
          </motion.div>

          {/* System Prompt */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>System Prompt</label>
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={5}
              className="gia-input mt-1.5 text-[11px] font-mono resize-none" style={{ minHeight: '80px' }} />
          </motion.div>

          {/* Tool selection */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>
              Tools <span className="text-[8px] font-normal lowercase" style={{ color: 'var(--gia-muted-2)' }}>(pick what this agent can do)</span>
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {AVAILABLE_TOOLS.map(t => {
                const T = t.icon;
                const active = tools.includes(t.id);
                return (
                  <button key={t.id} onClick={() => setTools(prev => active ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] text-left tap-feedback transition-all"
                    style={{
                      background: active ? `${getIconColor(icon)}10` : 'var(--gia-surface-2)',
                      border: active ? `1px solid ${getIconColor(icon)}30` : '1px solid var(--gia-border)',
                    }}>
                    <T size={12} style={{ color: active ? getIconColor(icon) : 'var(--gia-muted-2)' }} />
                    <div className="flex-1 min-w-0">
                      <span className="block font-medium truncate" style={{ color: active ? 'var(--gia-text)' : 'var(--gia-muted)' }}>{t.label}</span>
                      <span className="block text-[8px] truncate" style={{ color: 'var(--gia-muted-2)' }}>{t.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* File upload */}
          {!isEditing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Knowledge Files</label>
              <div onClick={() => fileRef.current?.click()}
                className="mt-1.5 border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer tap-feedback"
                style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-muted-2)' }}>
                <Upload size={18} className="text-violet-500/60" />
                <p className="text-[11px] font-medium" style={{ color: 'var(--gia-muted)' }}>Drop files or click to upload</p>
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
            </motion.div>
          )}

          {/* Edit mode files */}
          {isEditing && editAgent && editAgent.files.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Knowledge Files</label>
              <div className="mt-1.5 space-y-1">
                {editAgent.files.map(f => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px]" style={{ background: 'var(--gia-surface-2)' }}>
                    <FileText size={12} style={{ color: 'var(--gia-muted)' }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--gia-text)' }}>{f.name}</span>
                    <button onClick={() => useAgentStore.getState().removeFileFromAgent(editAgent.id, f.id)} style={{ color: 'var(--gia-muted-2)' }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {isEditing && editAgent && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer tap-feedback"
                style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-muted-2)' }}>
                <Upload size={14} />
                <span className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>Add more files</span>
              </div>
              <input ref={fileRef} type="file" multiple accept=".txt,.md,.pdf,.csv,.json,.html"
                onChange={(e) => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} className="hidden" />
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--gia-border)' }}>
          <button onClick={onClose} className="flex-1 gia-btn gia-btn-ghost text-xs py-2.5">Cancel</button>
          <button onClick={async () => {
            if (!name.trim()) return;
            if (isEditing) {
              onSave({ name: name.trim(), description: description.trim(), systemPrompt, icon, tools });
            } else {
              setUploading(true);
              const agent = useAgentStore.getState().addAgent({ name: name.trim(), description: description.trim(), systemPrompt, icon, tools });
              for (const file of files) {
                try { await useAgentStore.getState().addFileToAgent(agent.id, file); }
                catch (e) { console.error('Upload failed:', file.name, e); }
              }
              setUploading(false);
              onSave({ name: name.trim(), description: description.trim(), systemPrompt, icon, tools });
            }
          }} disabled={!name.trim() || uploading}
            className="flex-1 gia-btn gia-btn-primary text-xs py-2.5">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : null}
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
