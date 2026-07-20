import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ChevronRight, KeyRound, Settings2, Zap, Eye, Wrench, Cpu } from 'lucide-react';
import { useProviderStore } from '../../store/useProviderStore';
import { providerRegistry } from '../../services/ProviderRegistry';
import { useShallow } from 'zustand/react/shallow';
import ProviderIcon from '../ProviderIcon';

interface ModelSwitcherSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenEngine?: () => void;
}

const ModelBadges: React.FC<{ free?: boolean; vision?: boolean; tools?: boolean }> = ({ free, vision, tools }) => (
  <div className="flex items-center gap-1">
    {free && (
      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-semibold" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
        <Zap size={8} /> FREE
      </span>
    )}
    {vision && (
      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-semibold" style={{ background: 'rgba(236,72,153,0.12)', color: '#ec4899' }}>
        <Eye size={8} /> VISION
      </span>
    )}
    {tools && (
      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-semibold" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
        <Wrench size={8} /> TOOLS
      </span>
    )}
  </div>
);

const ModelSwitcherSheet: React.FC<ModelSwitcherSheetProps> = ({ open, onClose, onOpenEngine }) => {
  const {
    providers, activeProvider, availableModels,
    setActiveProvider, setProviderModel, setProviderKey, fetchModels,
  } = useProviderStore(useShallow((s) => ({
    providers: s.providers,
    activeProvider: s.activeProvider,
    availableModels: s.availableModels,
    setActiveProvider: s.setActiveProvider,
    setProviderModel: s.setProviderModel,
    setProviderKey: s.setProviderKey,
    fetchModels: s.fetchModels,
  })));

  const [selected, setSelected] = useState(activeProvider);
  const [keyInput, setKeyInput] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);

  // Keep the selected provider in sync when the sheet (re)opens.
  useEffect(() => { if (open) setSelected(activeProvider); }, [open, activeProvider]);

  const providerIds = providerRegistry.getAllIds();
  const selectedCfg = providers[selected];
  const selectedConnected = !!selectedCfg?.enabled && !!selectedCfg?.apiKey;
  const selectedNeedsKey = providerRegistry.getNeedsApiKey(selected);
  const currentModelId = selectedCfg?.model;

  // Pull live models for the selected provider when it's connected but unlisted.
  useEffect(() => {
    let cancelled = false;
    if (open && selectedConnected) {
      const have = availableModels[selected]?.length ?? 0;
      if (have === 0) {
        setLoadingModels(true);
        fetchModels(selected).catch(() => {}).finally(() => { if (!cancelled) setLoadingModels(false); });
      }
    }
    return () => { cancelled = true; };
  }, [open, selected, selectedConnected, availableModels, fetchModels]);

  const models = selectedConnected
    ? (availableModels[selected] ?? [])
    : providerRegistry.getModels(selected);

  const handleConnect = () => {
    const key = keyInput.trim();
    if (!key) return;
    setProviderKey(selected, key);
    setKeyInput('');
    setLoadingModels(true);
    fetchModels(selected).catch(() => {}).finally(() => setLoadingModels(false));
  };

  const handlePickModel = (modelId: string) => {
    setProviderModel(selected, modelId);
    if (selected !== activeProvider) setActiveProvider(selected);
    onClose();
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
            style={{ background: 'var(--gia-surface)', borderTop: '1px solid var(--gia-border)', maxHeight: '78vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {/* Grabber + header */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
                  <Cpu size={16} style={{ color: '#a855f7' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Model & Provider</p>
                  <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Switch without leaving the chat</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onOpenEngine && (
                  <button
                    onClick={() => { onClose(); onOpenEngine(); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                    style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}
                    title="Advanced connection settings"
                  >
                    <Settings2 size={12} /> Engine
                  </button>
                )}
                <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)' }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Provider column */}
              <div className="w-[42%] sm:w-[38%] overflow-y-auto p-2 space-y-1 shrink-0" style={{ borderRight: '1px solid var(--gia-border)' }}>
                {providerIds.map((pid) => {
                  const cfg = providers[pid];
                  const connected = !!cfg?.enabled && !!cfg?.apiKey;
                  const isActive = pid === activeProvider;
                  const isSel = pid === selected;
                  return (
                    <button
                      key={pid}
                      onClick={() => setSelected(pid)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all tap-feedback"
                      style={{
                        background: isSel ? 'rgba(168,85,247,0.12)' : 'transparent',
                        border: isSel ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                      }}
                    >
                      <span className="relative shrink-0">
                        <ProviderIcon provider={pid} size={24} />
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                          style={{ background: connected ? '#34d399' : '#52525b', borderColor: 'var(--gia-surface)' }}
                        />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12px] font-medium truncate" style={{ color: isSel ? 'var(--gia-text)' : 'var(--gia-muted)' }}>
                          {providerRegistry.getLabel(pid)}
                        </span>
                        <span className="block text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
                          {connected ? (isActive ? 'Active' : 'Connected') : 'Not connected'}
                        </span>
                      </span>
                      {isActive && <Check size={13} style={{ color: '#a855f7' }} />}
                    </button>
                  );
                })}
              </div>

              {/* Model column */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 min-w-0">
                {!selectedConnected && selectedNeedsKey ? (
                  <div className="p-3 flex flex-col gap-3">
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
                      Connect a <span className="font-semibold" style={{ color: 'var(--gia-text)' }}>{providerRegistry.getLabel(selected)}</span> API key to use its models.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                        placeholder="Paste API key…"
                        className="gia-input flex-1"
                        style={{ fontSize: '12px' }}
                      />
                      <button
                        onClick={handleConnect}
                        disabled={!keyInput.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-all"
                        style={{ background: 'rgba(168,85,247,0.18)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.3)' }}
                      >
                        <KeyRound size={12} /> Connect
                      </button>
                    </div>
                    <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
                      Keys are stored locally on this device. Or open Engine for advanced options.
                    </p>
                  </div>
                ) : loadingModels ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gia-border)', borderTopColor: '#a855f7' }} />
                  </div>
                ) : models.length === 0 ? (
                  <p className="text-[11px] text-center py-10" style={{ color: 'var(--gia-muted-2)' }}>No models available</p>
                ) : (
                  models.map((m) => {
                    const isCurrent = m.id === currentModelId && selected === activeProvider;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handlePickModel(m.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all tap-feedback"
                        style={{
                          background: isCurrent ? 'rgba(168,85,247,0.12)' : 'transparent',
                          border: isCurrent ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                        }}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{m.label}</span>
                          <span className="block mt-1"><ModelBadges free={m.free} vision={m.vision} tools={m.tools} /></span>
                        </span>
                        {isCurrent && <Check size={15} style={{ color: '#a855f7' }} />}
                        {!isCurrent && <ChevronRight size={14} style={{ color: 'var(--gia-muted-2)' }} />}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Retry fetch (no manual ID typing — models come from the API or curated catalog) */}
              {selectedConnected && !loadingModels && models.length === 0 && (
                <div className="p-3 shrink-0 flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--gia-border)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
                    Couldn&apos;t load models from {providerRegistry.getLabel(selected)}.
                  </p>
                  <button
                    onClick={() => { setLoadingModels(true); fetchModels(selected).catch(() => {}).finally(() => setLoadingModels(false)); }}
                    className="px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
                    style={{ background: 'rgba(168,85,247,0.18)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.3)' }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ModelSwitcherSheet;
