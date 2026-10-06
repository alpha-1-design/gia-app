import React, { useEffect, useState } from 'react';
import { Maximize2, Menu } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useGiaStore, Module } from '../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';
import { MODULES } from '../config/appModules';

interface AppNavigationProps {
  onModuleChange?: (mod: Module) => void;
}

const AppNavigation: React.FC<AppNavigationProps> = () => {
  const { currentModule, userProfile, connectionStatus, providerConnected, fullScreenMode, showLeftDrawer, toggleFullScreenMode, setShowLeftDrawer } = useGiaStore(useShallow(s => ({
    currentModule: s.currentModule,
    userProfile: s.userProfile,
    connectionStatus: s.connectionStatus,
    providerConnected: s.providerConnected,
    fullScreenMode: s.fullScreenMode,
    showLeftDrawer: s.showLeftDrawer,
    toggleFullScreenMode: s.toggleFullScreenMode,
    setShowLeftDrawer: s.setShowLeftDrawer,
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
  const navColor = (id: Module) => id === 'chat' ? '#a855f7' : id === 'exam' ? '#f59e0b' : id === 'analyst' ? '#3b82f6' : id === 'writer' ? '#ec4899' : id === 'planner' ? '#10b981' : id === 'agents' ? '#a855f7' : '#94a3b8';

  // Module switching lives in ProfileDrawer; the GIA mark is the persistent
  // navigation toggle, including while the drawer is open.
  const cur = MODULES.find(m => m.id === currentModule) ?? MODULES[0];

  return (
    <header
      className={`flex items-center justify-between px-4 py-2 shrink-0 relative ${showLeftDrawer ? 'z-[140]' : 'z-[100]'} h-14 overflow-visible`}
      style={{
        opacity: hydrated ? 1 : 0,
        transition: 'opacity 0.25s ease',
        background: showLeftDrawer ? 'var(--gia-surface)' : undefined,
        borderBottom: showLeftDrawer ? '1px solid var(--gia-border)' : undefined,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => setShowLeftDrawer(!showLeftDrawer)}
          className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg transition-transform active:scale-95"
          style={{ color: 'var(--gia-text)' }}
          aria-label={showLeftDrawer ? 'Close navigation' : 'Open navigation'}
          aria-expanded={showLeftDrawer}
          aria-controls="app-navigation-drawer"
        >
          <AnimatePresence mode="wait" initial={false}>
            {showLeftDrawer ? (
              <motion.span
                key="menu"
                initial={{ opacity: 0, rotate: reduceMotion ? 0 : -75, scale: reduceMotion ? 1 : 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: reduceMotion ? 0 : 75, scale: reduceMotion ? 1 : 0.7 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                aria-hidden="true"
              >
                <Menu size={19} strokeWidth={2.25} />
              </motion.span>
            ) : (
              <motion.span
                key="brand"
                className="text-lg font-bold tracking-tight leading-none"
                initial={{ opacity: 0, rotate: reduceMotion ? 0 : 75, scale: reduceMotion ? 1 : 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: reduceMotion ? 0 : -75, scale: reduceMotion ? 1 : 0.7 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
              >
                GIA
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        {/* Reserve the same space across modules so the header stays stable. */}
        <div className="w-[72px] shrink-0" aria-hidden>
          {currentModule !== 'chat' && (
            <span
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap"
              style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: navColor(cur.id) }}
            >
              <span className="shrink-0">{cur.icon}</span>
              <span>{cur.label}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor, boxShadow: statusGlow }} title={statusTitle} />
        {/* Lightning-bolt Protocols panel removed: tool-call approvals now
            render inline under GIA's own message (see MessageList.tsx /
            ProtocolCard's confirm+reject buttons), not behind a toggle the
            user had to remember to open. */}
        <button onClick={toggleFullScreenMode} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ background: fullScreenMode ? 'rgba(168,85,247,0.15)' : 'var(--gia-surface-2)', border: `1px solid ${fullScreenMode ? 'rgba(168,85,247,0.3)' : 'var(--gia-border)'}`, color: fullScreenMode ? '#a855f7' : 'var(--gia-muted)' }} title={fullScreenMode ? 'Exit full screen' : 'Enter full screen'}>
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
