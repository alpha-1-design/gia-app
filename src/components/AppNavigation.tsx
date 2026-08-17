import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, Maximize2 } from 'lucide-react';
import { MODULES } from '../config/appModules';
import { useGiaStore, Module } from '../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';

interface AppNavigationProps {
  onModuleChange?: (mod: Module) => void;
}

const AppNavigation: React.FC<AppNavigationProps> = () => {
  const { currentModule, setModule, userProfile, connectionStatus, providerConnected, showProtocols, setShowProtocols, fullScreenMode, toggleFullScreenMode, hiddenModules } = useGiaStore(useShallow(s => ({
    currentModule: s.currentModule,
    setModule: s.setModule,
    userProfile: s.userProfile,
    connectionStatus: s.connectionStatus,
    providerConnected: s.providerConnected,
    showProtocols: s.showProtocols,
    setShowProtocols: s.setShowProtocols,
    fullScreenMode: s.fullScreenMode,
    toggleFullScreenMode: s.toggleFullScreenMode,
    hiddenModules: s.hiddenModules,
  })));
  const visibleModules = MODULES.filter(m => !hiddenModules.includes(m.id));
  const [moduleOpen, setModuleOpen] = useState(false);
  const moduleRef = useRef<HTMLDivElement>(null);

  const statusColor = connectionStatus === 'offline' ? '#71717a' : !providerConnected ? '#f59e0b' : '#34d399';
  const statusTitle = connectionStatus === 'offline' ? 'Offline' : !providerConnected ? 'Online — connecting to provider…' : 'Connected';
  const statusGlow = connectionStatus === 'offline' ? 'none' : !providerConnected ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(52,211,153,0.5)';
  const navColor = (id: Module) => id === 'chat' ? '#a855f7' : id === 'exam' ? '#f59e0b' : id === 'analyst' ? '#3b82f6' : id === 'writer' ? '#ec4899' : id === 'planner' ? '#10b981' : id === 'agents' ? '#a855f7' : '#94a3b8';

  useEffect(() => {
    if (!moduleOpen) return;
    const handler = (e: MouseEvent) => {
      if (moduleRef.current && !moduleRef.current.contains(e.target as Node)) setModuleOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moduleOpen]);

  return (
    <header className="flex items-center justify-between px-4 py-2 shrink-0 relative z-[100] h-14 overflow-visible">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-lg font-bold tracking-tight leading-none" style={{ color: 'var(--gia-text)' }}>GIA</h1>
        </div>
        <div ref={moduleRef} className="relative z-[105]">
          {(() => {
            const cur = MODULES.find(m => m.id === currentModule) ?? MODULES[0];
            return (
              <>
                <button onClick={() => setModuleOpen(o => !o)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap tap-feedback" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: navColor(cur.id) }}>
                  <span className="shrink-0">{cur.icon}</span>
                  <span className="hidden sm:inline">{cur.label}</span>
                  <ChevronDown size={12} className={`transition-transform ${moduleOpen ? 'rotate-180' : ''}`} />
                </button>
                {moduleOpen && (
                  <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }} transition={{ duration: 0.12 }} className="absolute top-full left-0 mt-1 min-w-[160px] rounded-xl overflow-hidden shadow-2xl border z-[110]" style={{ background: 'rgba(20, 20, 28, 0.98)', borderColor: 'var(--gia-border)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
                    {visibleModules.map((mod) => {
                      const active = currentModule === mod.id;
                      return (
                        <button key={mod.id} onClick={() => { setModule(mod.id); setModuleOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] font-medium transition-all tap-feedback" style={{ color: active ? 'white' : 'var(--gia-muted)', background: active ? 'rgba(168,85,247,0.1)' : 'transparent' }}>
                          <span style={{ color: navColor(mod.id) }}>{mod.icon}</span>
                          <span className="flex-1 text-left">{mod.label}</span>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </>
            );
          })()}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor, boxShadow: statusGlow }} title={statusTitle} />
        <button onClick={() => setShowProtocols(!showProtocols)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all text-[10px] font-bold" style={{ background: showProtocols ? 'rgba(168,85,247,0.15)' : 'var(--gia-surface-2)', border: `1px solid ${showProtocols ? 'rgba(168,85,247,0.3)' : 'var(--gia-border)'}`, color: showProtocols ? '#a855f7' : 'var(--gia-muted)' }} title="Protocols">⚡</button>
        <button onClick={toggleFullScreenMode} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ background: fullScreenMode ? 'rgba(168,85,247,0.15)' : 'var(--gia-surface-2)', border: `1px solid ${fullScreenMode ? 'rgba(168,85,247,0.3)' : 'var(--gia-border)'}`, color: fullScreenMode ? '#a855f7' : 'var(--gia-muted)' }} title={fullScreenMode ? 'Exit full screen' : 'Enter full screen'}>
          <Maximize2 size={14} />
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 12px rgba(168,85,247,0.4)' }}>{userProfile.name ? userProfile.name[0].toUpperCase() : 'G'}</div>
      </div>
    </header>
  );
};

export default AppNavigation;