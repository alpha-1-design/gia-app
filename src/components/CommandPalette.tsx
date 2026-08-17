import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, Search, Globe, Brain, Hand, Eye,
  FolderOpen, Download, Upload, Eraser, Terminal, Settings,
  MessageCircle, PenLine, BarChart3, ClipboardList, Wifi, StickyNote
} from 'lucide-react';
import { useGiaStore, type Module } from '../store/useGiaStore';

interface Action {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  execute: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (action: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hiddenModules = useGiaStore((s) => s.hiddenModules);

  const iconStyle = { width: 15, height: 15 };

  // Maps a command's id to the module it switches to, so hidden modules
  // (Settings > Modules) drop out of the palette the same way they drop
  // out of the nav dropdown -- otherwise hiding a module there would be
  // pointless, since Cmd+K would still get you to it.
  const MODULE_COMMAND_IDS: Partial<Record<string, Module>> = {
    'module-writer': 'writer',
    'module-analyst': 'analyst',
    'module-planner': 'planner',
  };

  const actions: Action[] = [
    { id: 'new-chat', label: 'New Chat', description: 'Start a fresh conversation', icon: <MessageSquare {...iconStyle} />, category: 'Chat', execute: () => { useGiaStore.getState().createSession(); onClose(); } },
    { id: 'module-chat', label: 'Switch to Chat', description: 'Go to Chat module', icon: <MessageCircle {...iconStyle} />, category: 'Navigation', execute: () => { useGiaStore.getState().setModule('chat'); onClose(); } },
    { id: 'module-writer', label: 'Switch to Writer', description: 'Go to Writer module', icon: <PenLine {...iconStyle} />, category: 'Navigation', execute: () => { useGiaStore.getState().setModule('writer'); onClose(); } },
    { id: 'module-analyst', label: 'Switch to Analyst', description: 'Go to Analyst module', icon: <BarChart3 {...iconStyle} />, category: 'Navigation', execute: () => { useGiaStore.getState().setModule('analyst'); onClose(); } },
    { id: 'module-planner', label: 'Switch to Planner', description: 'Go to Planner module', icon: <ClipboardList {...iconStyle} />, category: 'Navigation', execute: () => { useGiaStore.getState().setModule('planner'); onClose(); } },
    { id: 'module-settings', label: 'Open Settings', description: 'Go to Settings module', icon: <Settings {...iconStyle} />, category: 'Navigation', execute: () => { useGiaStore.getState().setModule('settings'); onClose(); } },
    { id: 'toggle-websearch', label: 'Toggle Web Search', description: 'Enable or disable web search capability', icon: <Globe {...iconStyle} />, category: 'Tools', execute: () => { const s = useGiaStore.getState(); s.setWebSearch(!s.webSearch); s.addNotification(`Web search ${s.webSearch ? 'disabled' : 'enabled'}`); onClose(); } },
    { id: 'toggle-thinking', label: 'Toggle Extended Thinking', description: 'Show GIA\'s internal reasoning process', icon: <Brain {...iconStyle} />, category: 'Tools', execute: () => { const s = useGiaStore.getState(); s.setExtThinking(!s.extThinking); s.addNotification(`Extended thinking ${s.extThinking ? 'disabled' : 'enabled'}`); onClose(); } },
    { id: 'toggle-hands-off', label: 'Toggle Hands-Off Mode', description: 'Let GIA execute tools without asking', icon: <Hand {...iconStyle} />, category: 'Tools', execute: () => { const s = useGiaStore.getState(); s.setHandsOff(!s.handsOff); s.addNotification(`Hands-off ${s.handsOff ? 'disabled' : 'enabled'}`); onClose(); } },
    { id: 'toggle-tools', label: 'Toggle Tools Panel', description: 'Show or hide the tools observation panel', icon: <Eye {...iconStyle} />, category: 'Tools', execute: () => { useGiaStore.getState().setShowProtocols(!useGiaStore.getState().showProtocols); onClose(); } },
    { id: 'terminal', label: 'Open Engine Room', description: 'Access the provider management terminal', icon: <Terminal {...iconStyle} />, category: 'System', execute: () => { useGiaStore.getState().setShowTerminal(true); onClose(); } },
    { id: 'pick-folder', label: 'Pick Project Folder', description: 'Select a local folder for file access', icon: <FolderOpen {...iconStyle} />, category: 'Files', execute: () => { import('../services/DesktopFS').then(m => m.default.pickDirectory().then(r => { if (r) useGiaStore.getState().addNotification(`Project folder: ${r.name}`); })); onClose(); } },
    { id: 'export-brain', label: 'Export Brain', description: 'Download GIA memories as JSON', icon: <Download {...iconStyle} />, category: 'Files', execute: () => { import('../services/BrainExport').then(m => { m.exportBrainToFile(); useGiaStore.getState().addNotification('Brain exported'); }).catch(() => useGiaStore.getState().addNotification('Export failed')); onClose(); } },
    { id: 'import-brain', label: 'Import Brain', description: 'Restore GIA from a brain export file', icon: <Upload {...iconStyle} />, category: 'Files', execute: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        import('../services/BrainExport').then((m) => m.importBrainFromFile(file).then((r) => useGiaStore.getState().addNotification(r.message)).catch(() => useGiaStore.getState().addNotification('Import failed')))
          .catch(() => useGiaStore.getState().addNotification('Import failed'));
      };
      input.click();
      onClose();
    } },
    { id: 'clear-session', label: 'Clear Current Chat', description: 'Remove all messages from current session', icon: <Eraser {...iconStyle} />, category: 'Chat', execute: () => { const s = useGiaStore.getState(); const sid = s.activeSessionId; if (sid) { s.clearSession(sid); s.addNotification('Session cleared'); } onClose(); } },
    { id: 'mcp-servers', label: 'Manage MCP Servers', description: 'Configure and connect to MCP servers', icon: <Wifi {...iconStyle} />, category: 'System', execute: () => { useGiaStore.getState().setModule('settings'); onClose(); } },
    { id: 'task-board', label: 'Open Task Board', description: 'View and manage your tasks', icon: <ClipboardList {...iconStyle} />, category: 'Co-Work', execute: () => { void onNavigate?.('task-board'); onClose(); } },
    { id: 'notes-panel', label: 'Open Notes', description: 'View and manage your notes', icon: <StickyNote {...iconStyle} />, category: 'Co-Work', execute: () => { void onNavigate?.('notes-panel'); onClose(); } },
  ];

  const visibleActions = actions.filter(a => {
    const mod = MODULE_COMMAND_IDS[a.id];
    return !mod || !hiddenModules.includes(mod);
  });

  const filtered = query.trim()
    ? visibleActions.filter(a => {
        const q = query.toLowerCase();
        return a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
      })
    : visibleActions;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        filtered[selectedIdx].execute();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIdx, onClose]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!isOpen) return null;

  const grouped = filtered.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<string, Action[]>);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--gia-border)' }}>
          <Search size={16} style={{ color: 'var(--gia-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--gia-text)' }}
          />
          <kbd className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--gia-muted-2)' }}>
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2 space-y-1">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1.5" style={{ color: 'var(--gia-muted-2)' }}>
                {category}
              </p>
              {items.map((action) => {
                const globalIdx = filtered.indexOf(action);
                const isSelected = globalIdx === selectedIdx;
                return (
                  <button
                    type="button"
                    key={action.id}
                    onClick={action.execute}
                    onMouseEnter={() => setSelectedIdx(globalIdx)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all"
                    style={{
                      background: isSelected ? 'rgba(168,85,247,0.12)' : 'transparent',
                      color: 'var(--gia-text)',
                    }}
                  >
                    <span className="shrink-0" style={{ color: 'var(--gia-muted)' }}>
                      {action.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{action.label}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted-2)' }}>
                        {action.description}
                      </p>
                    </div>
                    {isSelected && (
                      <kbd className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7' }}>
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-center py-6" style={{ color: 'var(--gia-muted-2)' }}>
              No commands found for "{query}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
