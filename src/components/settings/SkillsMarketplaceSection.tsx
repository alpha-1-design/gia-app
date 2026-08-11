import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Download, Trash2, Plus, RefreshCw, Star, ExternalLink, Package, Code, Shield, Palette, BookOpen, Database, Smartphone, Brain, ChevronDown, X, Check, Loader2 } from 'lucide-react';
import SkillsMarketplace from '../../services/SkillsMarketplace';
import type { MarketplaceSkill } from '../../services/SkillsMarketplace';
import { useGiaStore } from '../../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  engineering: <Code size={14} style={{ color: '#3b82f6' }} />,
  security: <Shield size={14} style={{ color: '#ef4444' }} />,
  content: <BookOpen size={14} style={{ color: '#f59e0b' }} />,
  creative: <Palette size={14} style={{ color: '#ec4899' }} />,
  data: <Database size={14} style={{ color: '#22c55e' }} />,
  mobile: <Smartphone size={14} style={{ color: '#8b5cf6' }} />,
  research: <Brain size={14} style={{ color: '#06b6d4' }} />,
  general: <Package size={14} style={{ color: '#94a3b8' }} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  engineering: '#3b82f6',
  security: '#ef4444',
  content: '#f59e0b',
  creative: '#ec4899',
  data: '#22c55e',
  mobile: '#8b5cf6',
  research: '#06b6d4',
  general: '#94a3b8',
};

interface SkillsMarketplaceProps {
  mode: 'settings' | 'chat';
  onClose?: () => void;
}

export const SkillsMarketplaceUI: React.FC<SkillsMarketplaceProps> = ({ mode, onClose }) => {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customCategory, setCustomCategory] = useState('general');
  const { activeSkillId, setSkill, addNotification } = useGiaStore(useShallow(s => ({
    activeSkillId: s.activeSkillId,
    setSkill: s.setSkill,
    addNotification: s.addNotification,
  })));

  const fetchSkills = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const fetched = await SkillsMarketplace.fetchSkills(force);
      setSkills(fetched);
    } catch {
      addNotification('Failed to load skills marketplace');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const filtered = skills.filter(s => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q) && !s.tags.some(t => t.includes(q))) return false;
    }
    if (selectedCategory && s.category !== selectedCategory) return false;
    return true;
  });

  const installed = filtered.filter(s => s.installed);
  const available = filtered.filter(s => !s.installed);
  const categories = Array.from(new Set(skills.map(s => s.category))).sort();

  const handleInstall = async (skillId: string) => {
    const result = await SkillsMarketplace.installSkill(skillId);
    if (result.success) {
      addNotification('Skill installed');
      setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installed: true } : s));
    } else {
      addNotification(result.error || 'Install failed');
    }
  };

  const handleUninstall = async (skillId: string) => {
    const result = await SkillsMarketplace.uninstallSkill(skillId);
    if (result.success) {
      addNotification('Skill uninstalled');
      setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installed: false } : s));
    }
  };

  const handleActivate = (skillId: string) => {
    setSkill(skillId);
    addNotification(`Skill activated: ${skills.find(s => s.id === skillId)?.name}`);
  };

  const handleCreateCustom = async () => {
    if (!customName.trim() || !customPrompt.trim()) return;
    const skill = await SkillsMarketplace.createCustomSkill({
      name: customName,
      description: customDesc || `Custom skill: ${customName}`,
      category: customCategory,
      systemPrompt: customPrompt,
      tools: ['web_search', 'terminal_run', 'filesystem_read', 'filesystem_write'],
    });
    setSkills(prev => [...prev, skill]);
    setCreatingCustom(false);
    setCustomName('');
    setCustomDesc('');
    setCustomPrompt('');
    addNotification(`Custom skill "${skill.name}" created`);
  };

  const renderSkillCard = (skill: MarketplaceSkill) => {
    const isExpanded = expandedSkill === skill.id;
    const isActive = activeSkillId === skill.id;
    const catColor = CATEGORY_COLORS[skill.category] || '#94a3b8';

    return (
      <motion.div
        key={skill.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border overflow-hidden"
        style={{
          background: isActive ? `${catColor}10` : 'var(--gia-surface)',
          borderColor: isActive ? `${catColor}40` : 'var(--gia-border)',
        }}
      >
        <div
          className="px-3 py-2.5 flex items-center gap-2.5 cursor-pointer"
          onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${catColor}20` }}>
            {CATEGORY_ICONS[skill.category] || <Package size={14} style={{ color: catColor }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{skill.name}</span>
              {skill.installed && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#22c55e20', color: '#22c55e' }}>
                  {isActive ? 'Active' : 'Installed'}
                </span>
              )}
              {skill.source === 'custom' && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#a855f720', color: '#a855f7' }}>Custom</span>
              )}
            </div>
            <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted)' }}>{skill.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {skill.installed && !isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); handleActivate(skill.id); }}
                className="text-[9px] px-2 py-1 rounded-lg font-medium"
                style={{ background: `${catColor}20`, color: catColor }}
              >
                Activate
              </button>
            )}
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown size={12} style={{ color: 'var(--gia-muted)' }} />
            </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pb-3 overflow-hidden"
            >
              <div className="pt-2 border-t" style={{ borderColor: 'var(--gia-border)' }}>
                <div className="flex flex-wrap gap-1 mb-2">
                  {skill.tags.map(tag => (
                    <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--gia-border)', color: 'var(--gia-muted)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[9px] mb-2" style={{ color: 'var(--gia-muted)' }}>
                  <span>by {skill.author}</span>
                  <span>v{skill.version}</span>
                  {skill.rating > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star size={8} style={{ color: '#f59e0b' }} fill="#f59e0b" />
                      {skill.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Download size={8} />
                    {skill.installs.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed mb-2" style={{ color: 'var(--gia-muted)' }}>{skill.description}</p>
                {skill.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {skill.tools.map(tool => (
                      <span key={tool} className="text-[8px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {skill.installed ? (
                    <>
                      {isActive && (
                        <button
                          onClick={() => { setSkill(null); addNotification('Skill deactivated'); }}
                          className="text-[9px] px-2.5 py-1 rounded-lg font-medium"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        onClick={() => handleUninstall(skill.id)}
                        className="text-[9px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                      >
                        <Trash2 size={9} /> Uninstall
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleInstall(skill.id)}
                      className="text-[9px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"
                      style={{ background: `${catColor}20`, color: catColor }}
                    >
                      <Download size={9} /> Install
                    </button>
                  )}
                  {skill.sourceUrl && (
                    <a
                      href={skill.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] px-2 py-1 rounded-lg flex items-center gap-1"
                      style={{ color: 'var(--gia-muted)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={8} /> Source
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className={`flex flex-col ${mode === 'settings' ? 'h-full overflow-y-auto' : 'max-h-[70vh]'}`} style={{ background: mode === 'settings' ? 'var(--gia-bg)' : 'rgba(15,15,22,0.95)', padding: mode === 'settings' ? '20px 16px' : '16px', gap: '12px' }}>
      {mode === 'settings' && (
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--gia-text)' }}>Skills Marketplace</h2>
            <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Discover, install, and create AI skills</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--gia-muted)' }}>
            <X size={16} />
          </button>
        </div>
      )}
      {mode === 'chat' && (
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold" style={{ color: 'var(--gia-text)' }}>Skills Marketplace</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--gia-muted)' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative shrink-0">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--gia-muted-2)' }} />
        <input
          className="w-full text-[11px] pl-8 pr-3 py-2 rounded-xl"
          style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border-2)', color: 'var(--gia-text)' }}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search skills..."
        />
      </div>

      {/* Categories */}
      <div className="flex gap-1.5 overflow-x-auto shrink-0 [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setSelectedCategory(null)}
          className="text-[9px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium"
          style={{
            background: !selectedCategory ? 'rgba(168,85,247,0.2)' : 'var(--gia-surface-2)',
            color: !selectedCategory ? '#a855f7' : 'var(--gia-muted)',
            border: `1px solid ${!selectedCategory ? 'rgba(168,85,247,0.3)' : 'var(--gia-border)'}`,
          }}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className="text-[9px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium flex items-center gap-1"
            style={{
              background: selectedCategory === cat ? `${CATEGORY_COLORS[cat] || '#94a3b8'}20` : 'var(--gia-surface-2)',
              color: selectedCategory === cat ? CATEGORY_COLORS[cat] || '#94a3b8' : 'var(--gia-muted)',
              border: `1px solid ${selectedCategory === cat ? `${CATEGORY_COLORS[cat] || '#94a3b8'}40` : 'var(--gia-border)'}`,
            }}
          >
            {CATEGORY_ICONS[cat]}
            {cat}
          </button>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreatingCustom(true)}
            className="text-[9px] px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}
          >
            <Plus size={10} /> Create Custom
          </button>
          <button
            onClick={() => fetchSkills(true)}
            className="text-[9px] px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1"
            style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)', border: '1px solid var(--gia-border)' }}
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
          {installed.length} installed · {available.length} available
        </span>
      </div>

      {/* Custom skill creator */}
      <AnimatePresence>
        {creatingCustom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="rounded-xl border p-3 overflow-hidden"
            style={{ background: 'rgba(168,85,247,0.05)', borderColor: 'rgba(168,85,247,0.2)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold" style={{ color: '#a855f7' }}>Create Custom Skill</span>
              <button onClick={() => setCreatingCustom(false)} style={{ color: 'var(--gia-muted)' }}><X size={12} /></button>
            </div>
            <input
              className="w-full text-[10px] px-2.5 py-1.5 rounded-lg mb-2"
              style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border-2)', color: 'var(--gia-text)' }}
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Skill name"
            />
            <input
              className="w-full text-[10px] px-2.5 py-1.5 rounded-lg mb-2"
              style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border-2)', color: 'var(--gia-text)' }}
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Short description"
            />
            <select
              className="w-full text-[10px] px-2.5 py-1.5 rounded-lg mb-2"
              style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border-2)', color: 'var(--gia-text)' }}
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="general">general</option>
            </select>
            <textarea
              className="w-full text-[10px] px-2.5 py-1.5 rounded-lg mb-2 resize-none"
              style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border-2)', color: 'var(--gia-text)', minHeight: '60px' }}
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="System prompt — how should GIA behave with this skill?"
            />
            <button
              onClick={handleCreateCustom}
              disabled={!customName.trim() || !customPrompt.trim()}
              className="text-[9px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 disabled:opacity-40"
              style={{ background: '#a855f720', color: '#a855f7' }}
            >
              <Check size={10} /> Create & Install
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={14} className="animate-spin" style={{ color: '#a855f7' }} />
            <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Loading skills...</span>
          </div>
        ) : (
          <>
            {installed.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5 px-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
                  <span className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: '#22c55e' }}>Installed</span>
                </div>
                {installed.map(renderSkillCard)}
              </div>
            )}
            {available.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5 px-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ color: 'var(--gia-muted)' }} />
                  <span className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: 'var(--gia-muted)' }}>Available</span>
                </div>
                {available.map(renderSkillCard)}
              </div>
            )}
            {filtered.length === 0 && (
              <div className="text-center py-8">
                <Package size={20} style={{ color: 'var(--gia-muted-2)', margin: '0 auto 8px' }} />
                <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>No skills found</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SkillsMarketplaceUI;
