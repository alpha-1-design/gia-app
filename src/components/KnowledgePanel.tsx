import React, { useState, useMemo } from 'react';
import { useMemoryStore, MemoryCategory, MemoryEntry } from '../store/useMemoryStore';
import { useGiaStore } from '../store/useGiaStore';
import { Search, Pin, PinOff, Plus, X, Download, Upload, Brain, BookOpen, Star, Target, AlertTriangle, Heart, Briefcase, FileText, RotateCcw, Edit3 } from 'lucide-react';

const CATEGORY_META: Record<MemoryCategory, { label: string; icon: React.ReactNode; color: string }> = {
  profile: { label: 'Profile', icon: <Star size={11} />, color: '#a855f7' },
  fact: { label: 'Facts', icon: <BookOpen size={11} />, color: '#3b82f6' },
  preference: { label: 'Preferences', icon: <Heart size={11} />, color: '#ec4899' },
  goal: { label: 'Goals', icon: <Target size={11} />, color: '#10b981' },
  subject: { label: 'Subjects', icon: <BookOpen size={11} />, color: '#f59e0b' },
  score: { label: 'Scores', icon: <FileText size={11} />, color: '#06b6d4' },
  weak_area: { label: 'Weak Areas', icon: <AlertTriangle size={11} />, color: '#f97316' },
  project: { label: 'Projects', icon: <Briefcase size={11} />, color: '#8b5cf6' },
  session_summary: { label: 'Summaries', icon: <FileText size={11} />, color: '#64748b' },
  correction: { label: 'Corrections', icon: <RotateCcw size={11} />, color: '#f43f5e' },
  emotion: { label: 'Emotions', icon: <Heart size={11} />, color: '#f43f5e' },
};

const KnowledgeCard: React.FC<{ entry: MemoryEntry; pinned: boolean; onTogglePin: (id: string) => void; onDelete: (id: string) => void }> = ({ entry, pinned, onTogglePin, onDelete }) => {
  const meta = CATEGORY_META[entry.category] || CATEGORY_META.fact;

  return (
    <div className="flex items-start gap-2 p-2.5 rounded-xl transition-all group" style={{ background: pinned ? 'rgba(168,85,247,0.06)' : 'var(--gia-surface-2)', border: `1px solid ${pinned ? 'rgba(168,85,247,0.2)' : 'var(--gia-border)'}` }}>
      <button onClick={() => onTogglePin(entry.id)} className="mt-0.5 shrink-0 p-0.5 rounded transition-colors" style={{ color: pinned ? '#a855f7' : 'var(--gia-muted-2)' }}>
        {pinned ? <Pin size={10} fill="#a855f7" /> : <PinOff size={10} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span style={{ color: meta.color }}>{meta.icon}</span>
          <span className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-[7px]" style={{ color: 'var(--gia-muted-2)' }}>{Math.round(entry.confidence * 100)}%</span>
        </div>
        <p className="text-[11px] font-medium leading-tight" style={{ color: 'var(--gia-text)' }}>{entry.key}</p>
        <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: 'var(--gia-muted)' }}>{entry.value}</p>
      </div>
      <button onClick={() => onDelete(entry.id)} className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded" style={{ color: 'var(--gia-muted)' }}>
        <X size={10} />
      </button>
    </div>
  );
};

export const KnowledgePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { memories, addMemory, deleteMemory, clearMemories } = useMemoryStore();
  const { customInstructions, setCustomInstructions, pinnedMemories, togglePinnedMemory } = useGiaStore();
  const [tab, setTab] = useState<'knowledge' | 'instructions'>('knowledge');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<MemoryCategory | 'pinned' | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCat, setNewCat] = useState<MemoryCategory>('fact');
  const [instText, setInstText] = useState(customInstructions);

  const filtered = useMemo(() => {
    let items = memories;
    if (filterCat === 'pinned') items = items.filter(m => pinnedMemories.includes(m.id));
    else if (filterCat !== 'all') items = items.filter(m => m.category === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(m => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q));
    }
    return [...items].sort((a, b) => {
      const aPinned = pinnedMemories.includes(a.id);
      const bPinned = pinnedMemories.includes(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return b.timestamp - a.timestamp;
    });
  }, [memories, search, filterCat, pinnedMemories]);

  const addFact = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    addMemory({ key: newKey.trim(), value: newValue.trim(), category: newCat, confidence: 1 });
    setNewKey(''); setNewValue(''); setShowAddForm(false);
  };

  const exportAll = () => {
    const data = { memories, customInstructions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `gia-knowledge-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const importAll = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.memories) data.memories.forEach((m: any) => addMemory(m));
        if (data.customInstructions) setCustomInstructions(data.customInstructions);
      } catch { alert('Invalid knowledge file'); }
    };
    input.click();
  };

  const categoryCount = (cat: string) => {
    if (cat === 'pinned') return pinnedMemories.length;
    if (cat === 'all') return memories.length;
    return memories.filter(m => m.category === cat).length;
  };

  const saveInstructions = () => {
    setCustomInstructions(instText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
          <div className="flex items-center gap-2">
            <Brain size={14} style={{ color: '#a855f7' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Knowledge</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportAll} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg transition-colors" style={{ color: 'var(--gia-muted)', background: 'var(--gia-surface-3)' }}><Download size={10} /> Export</button>
            <button onClick={importAll} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg transition-colors" style={{ color: 'var(--gia-muted)', background: 'var(--gia-surface-3)' }}><Upload size={10} /> Import</button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--gia-muted)' }}><X size={14} /></button>
          </div>
        </div>

        <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
          {(['knowledge', 'instructions'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-2.5 text-[11px] font-medium transition-all relative" style={{ color: tab === t ? '#a855f7' : 'var(--gia-muted-2)' }}>
              {t === 'knowledge' ? '💾 Memories' : '📝 Instructions'}
              {tab === t && <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ background: '#a855f7' }} />}
            </button>
          ))}
        </div>

        {tab === 'instructions' ? (
          <div className="flex-1 flex flex-col p-4 gap-3">
            <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>Custom instructions are injected into every conversation. Tell GIA how to behave, facts about yourself, or rules to follow.</p>
            <textarea
              value={instText}
              onChange={e => setInstText(e.target.value)}
              placeholder="Example: I'm a Ghanaian JHS student preparing for BECE. Explain concepts simply and give real-world examples from West Africa."
              className="flex-1 min-h-[180px] p-3 rounded-xl text-xs leading-relaxed resize-none outline-none"
              style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setInstText(''); setCustomInstructions(''); }} className="text-[10px] px-3 py-1.5 rounded-lg" style={{ color: 'var(--gia-muted)', background: 'var(--gia-surface-3)' }}>Clear</button>
              <button onClick={saveInstructions} className="text-[10px] px-3 py-1.5 rounded-lg font-medium" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>Save Instructions</button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
              <Search size={12} style={{ color: 'var(--gia-muted-2)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memories..." className="flex-1 bg-transparent text-xs outline-none py-1.5" style={{ color: 'var(--gia-text)' }} />
              <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg transition-colors" style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)' }}>
                <Plus size={10} /> Add Fact
              </button>
            </div>

            <div className="flex gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
              {(['all', 'pinned', ...Object.keys(CATEGORY_META)] as (MemoryCategory | 'pinned' | 'all')[]).map(cat => {
                const active = filterCat === cat;
                const meta = cat === 'all' ? { label: 'All', icon: null, color: '#a855f7' }
                  : cat === 'pinned' ? { label: 'Pinned', icon: <Pin size={9} />, color: '#a855f7' }
                  : CATEGORY_META[cat];
                const count = categoryCount(cat);
                if (count === 0 && cat !== 'all' && cat !== 'pinned') return null;
                return (
                  <button key={cat} onClick={() => setFilterCat(cat)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap transition-all shrink-0" style={{ background: active ? `${meta.color}20` : 'var(--gia-surface-3)', color: active ? meta.color : 'var(--gia-muted-2)', border: active ? `1px solid ${meta.color}30` : '1px solid transparent' }}>
                    {meta.icon}{meta.label} <span style={{ opacity: 0.6 }}>{count}</span>
                  </button>
                );
              })}
            </div>

            {showAddForm && (
              <div className="mx-4 mt-3 p-3 rounded-xl shrink-0" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
                <div className="flex gap-2 mb-2">
                  <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Fact title (e.g. My favorite subject)" className="flex-1 bg-transparent text-[11px] outline-none p-1.5 rounded-lg" style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }} />
                  <select value={newCat} onChange={e => setNewCat(e.target.value as MemoryCategory)} className="text-[10px] p-1 rounded-lg outline-none" style={{ background: 'var(--gia-surface)', color: 'var(--gia-muted)', border: '1px solid var(--gia-border)' }}>
                    {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <textarea value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Fact details..." className="w-full bg-transparent text-[11px] outline-none p-1.5 rounded-lg resize-none" rows={2} style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }} />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowAddForm(false)} className="text-[10px] px-2 py-1 rounded-lg" style={{ color: 'var(--gia-muted)' }}>Cancel</button>
                  <button onClick={addFact} className="text-[10px] px-3 py-1 rounded-lg font-medium" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>Save Fact</button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Brain size={28} style={{ color: 'var(--gia-muted-2)', opacity: 0.2 }} />
                  <p className="text-xs mt-3" style={{ color: 'var(--gia-muted-2)' }}>No memories yet</p>
                  <p className="text-[10px] mt-1 max-w-[200px]" style={{ color: 'var(--gia-muted-2)', opacity: 0.6 }}>GIA learns from conversations. You can also add facts manually.</p>
                  <button onClick={() => setShowAddForm(true)} className="mt-4 flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}><Plus size={10} /> Add a fact</button>
                </div>
              ) : (
                filtered.map(m => (
                  <KnowledgeCard key={m.id} entry={m} pinned={pinnedMemories.includes(m.id)} onTogglePin={togglePinnedMemory} onDelete={deleteMemory} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
