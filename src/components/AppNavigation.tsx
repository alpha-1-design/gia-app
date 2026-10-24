import React, { useEffect, useState } from 'react';
import { Maximize2, Menu, MessageSquare, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useGiaStore, Module } from '../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';
import { MODULES } from '../config/appModules';

interface AppNavigationProps {
  onModuleChange?: (mod: Module) => void;
}

const AppNavigation: React.FC<AppNavigationProps> = () => {
  const { currentModule, userProfile, connectionStatus, providerConnected, fullScreenMode, showLeftDrawer, toggleFullScreenMode, setShowLeftDrawer, showHud, setShowHud } = useGiaStore(useShallow(s => ({
    currentModule: s.currentModule,
    userProfile: s.userProfile,
    connectionStatus: s.connectionStatus,
    providerConnected: s.providerConnected,
    fullScreenMode: s.fullScreenMode,
    showLeftDrawer: s.showLeftDrawer,
    toggleFullScreenMode: s.toggleFullScreenMode,
    setShowLeftDrawer: s.setShowLeftDrawer,
    showHud: s.showHud,
    setShowHud: s.setShowHud,
  })));

  // Track hydration so dynamic elements fade in smoothly instead of popping
  const [hydrated, setHydrated] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    // A single rAF + short delay ensures Zustand's IndexedDB rehydration has
    // completed and the first paint with real data is ready.
    const id = requestAnimationFrame(() => setTimeout(() => setHydrated(true), 50));
    return () => cancelAnimationFrame(id);
  }, []);

  const statusColor = connectionStatus === 'offline' ? '#71717a' : !providerConnected ? '#f59e0b' : '#34d399';
  const statusTitle = connectionStatus === 'offline' ? 'Offline' : !providerConnected ? 'No AI provider connected' : 'Connected';
  const statusGlow = connectionStatus === 'offline' ? 'none' : !providerConnected ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(52,211,153,0.5)';
  const navColor = 'var(--gia-text)';

  // Module switching lives in ProfileDrawer; the menu button and module chip
  // keep that navigation visible at the top.
  const cur = MODULES.find(m => m.id === currentModule) ?? MODULES[0];

  return (
    <header
      role="navigation"
      aria-label="GIA navigation"
      className={`flex items-center justify-between px-3 py-2 shrink-0 relative ${showLeftDrawer ? 'z-[140]' : 'z-[100]'} h-14 overflow-visible`}
      style={{
        opacity: hydrated ? 1 : 0,
        transition: 'opacity 0.25s ease, background 0.2s ease',
        background: 'var(--gia-surface)',
        borderBottom: '1px solid var(--gia-border)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => setShowLeftDrawer(!showLeftDrawer)}
          className="w-9 h-9 flex items-center justify-center shrink-0 rounded-xl transition-transform active:scale-95"
          style={{
            color: showLeftDrawer ? '#a855f7' : 'var(--gia-text)',
            background: showLeftDrawer ? 'rgba(168,85,247,0.14)' : 'var(--gia-surface-2)',
            border: '1px solid var(--gia-border)',
          }}
          aria-label={showLeftDrawer ? 'Close navigation' : 'Open navigation'}
          aria-expanded={showLeftDrawer}
          aria-controls="app-navigation-drawer"
        >
          <AnimatePresence mode="wait" initial={false}>
            {showLeftDrawer ? (
              <motion.span
                key="close"
                initial={{ opacity: 0, rotate: reduceMotion ? 0 : -75, scale: reduceMotion ? 1 : 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: reduceMotion ? 0 : 75, scale: reduceMotion ? 1 : 0.7 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                aria-hidden="true"
              >
                <X size={18} strokeWidth={2.25} />
              </motion.span>
            ) : (
              <motion.span
                key="menu"
                initial={{ opacity: 0, rotate: reduceMotion ? 0 : 75, scale: reduceMotion ? 1 : 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: reduceMotion ? 0 : -75, scale: reduceMotion ? 1 : 0.7 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                aria-hidden="true"
              >
                <Menu size={18} strokeWidth={2.25} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg font-bold tracking-tight leading-none shrink-0" style={{ color: 'var(--gia-text)' }}>
            GIA
          </span>
          <button
            type="button"
            onClick={() => setShowLeftDrawer(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold min-w-0 max-w-[112px] transition-opacity active:opacity-70"
            style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: navColor }}
            aria-label={`Current module: ${cur.label}`}
            title="Switch module"
          >
            <span className="shrink-0">{cur.icon}</span>
            <span className="truncate">{cur.label}</span>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor, boxShadow: statusGlow }} title={statusTitle} />
        <button
          type="button"
          onClick={() => setShowHud(!showHud)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{ background: showHud ? 'var(--gia-surface-3)' : 'var(--gia-surface-2)', border: `1px solid ${showHud ? 'var(--gia-text)' : 'var(--gia-border)'}`, color: showHud ? 'var(--gia-text)' : 'var(--gia-muted)' }}
          title={showHud ? 'Turn off floating chat' : 'Open floating chat'}
          aria-label={showHud ? 'Turn off floating chat' : 'Open floating chat'}
          aria-pressed={showHud}
        >
          <MessageSquare size={13} />
        </button>
        <button onClick={toggleFullScreenMode} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ background: fullScreenMode ? 'var(--gia-surface-3)' : 'var(--gia-surface-2)', border: `1px solid ${fullScreenMode ? 'var(--gia-text)' : 'var(--gia-border)'}`, color: fullScreenMode ? 'var(--gia-text)' : 'var(--gia-muted)' }} title={fullScreenMode ? 'Exit full screen' : 'Enter full screen'}>
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          onClick={() => setShowLeftDrawer(!showLeftDrawer)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 tap-feedback"
          style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 12px rgba(168,85,247,0.4)' }}
          aria-label={showLeftDrawer ? 'Close navigation from profile' : 'Open profile and navigation'}
          aria-expanded={showLeftDrawer}
          aria-controls="app-navigation-drawer"
          title="Profile & Settings"
        >
          {userProfile.name ? userProfile.name[0].toUpperCase() : 'G'}
        </button>
      </div>
    </header>
  );
};

export default AppNavigation;
