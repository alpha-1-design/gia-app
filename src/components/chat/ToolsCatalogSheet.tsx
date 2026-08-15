import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Globe, Code2, FileText, Image, Cpu, Wrench } from 'lucide-react';
import giaTools from '../../services/GiaTools';
import type { LucideIcon } from 'lucide-react';

interface ToolsCatalogSheetProps {
  open: boolean;
  onClose: () => void;
}

// Same taxonomy as the Agents tool picker — every registered tool, grouped.
const CATEGORY_RULES: { test: (id: string) => boolean; category: string; icon: LucideIcon }[] = [
  { test: (id) => ['web_search', 'read_url', 'browser_navigate', 'wikipedia', 'page_info', 'search_places', 'show_map', 'get_directions', 'web_scrape', 'http_request', 'network_scan', 'network_connectivity', 'network_detect'].includes(id), category: 'Web & Search', icon: Globe },
  { test: (id) => /^(terminal_|code_|build_|zip_|github|ssh_|db_|filegen|create_pdf|read_pdf|document)/.test(id), category: 'Code & Dev', icon: Code2 },
  { test: (id) => /^(filesystem_|list_files|file_|rag_|neura_)/.test(id), category: 'Files & Data', icon: FileText },
  { test: (id) => /^(image_|save_memory|forget_memory|request_clarification|summarize_|brain_|skill)/.test(id), category: 'AI & Creative', icon: Image },
  { test: () => true, category: 'System & Device', icon: Cpu },
];

function categorize(id: string): { category: string; icon: LucideIcon } {
  const rule = CATEGORY_RULES.find(r => r.test(id)) || CATEGORY_RULES[CATEGORY_RULES.length - 1];
  return { category: rule.category, icon: rule.icon };
}

export const ToolsCatalogSheet: React.FC<ToolsCatalogSheetProps> = ({ open, onClose }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const tools = giaTools.getAllTools();
    const map = new Map<string, { id: string; description: string; icon: LucideIcon }[]>();
    for (const t of tools) {
      const { category, icon } = categorize(t.id);
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push({ id: t.id, description: t.description || '', icon });
    }
    return Array.from(map.entries()).map(([category, list]) => ({
      category,
      list: list.sort((a, b) => a.id.localeCompare(b.id)),
    }));
  }, []);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[121] rounded-t-3xl overflow-hidden flex flex-col"
            style={{ background: 'var(--gia-surface)', borderTop: '1px solid var(--gia-border)', maxHeight: '82vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
                  <Wrench size={16} style={{ color: '#a855f7' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>All Tools ({giaTools.getAllTools().length})</p>
                  <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Tap a tool to copy its ID — then just ask GIA to use it</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)' }}>
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {groups.map(({ category, list }) => (
                <div key={category}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--gia-muted-2)' }}>
                    {category} · {list.length}
                  </p>
                  <div className="space-y-1">
                    {list.map(t => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id}
                          onClick={() => copyId(t.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all tap-feedback"
                          style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
                        >
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.1)' }}>
                            <Icon size={12} style={{ color: '#a855f7' }} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[11px] font-medium font-mono truncate" style={{ color: 'var(--gia-text)' }}>{t.id}</span>
                            {t.description && (
                              <span className="block text-[9px] truncate" style={{ color: 'var(--gia-muted-2)' }}>{t.description}</span>
                            )}
                          </span>
                          {copiedId === t.id ? (
                            <Check size={13} style={{ color: '#34d399' }} />
                          ) : (
                            <Copy size={12} style={{ color: 'var(--gia-muted-2)' }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ToolsCatalogSheet;
