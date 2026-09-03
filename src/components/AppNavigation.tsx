import React, { useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { useGiaStore, Module } from '../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';
import { MODULES } from '../config/appModules';

interface AppNavigationProps {
  onModuleChange?: (mod: Module) => void;
}

const AppNavigation: React.FC<AppNavigationProps> = () => {
  const { currentModule, userProfile, connectionStatus, providerConnected, fullScreenMode, toggleFullScreenMode, setShowLeftDrawer } = useGiaStore(useShallow(s => ({
    currentModule: s.currentModule,
    userProfile: s.userProfile,
    connectionStatus: s.connectionStatus,
    providerConnected: s.providerConnected,
    fullScreenMode: s.fullScreenMode,
    toggleFullScreenMode: s.toggleFullScreenMode,
    setShowLeftDrawer: s.setShowLeftDrawer,
  })));

  // Track hydration so dynamic elements fade in smoothly instead of popping
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // A single rAF + short delay ensures Zustand's IndexedDB rehydration has
    // completed and the first paint with real data is ready.
    const id = requestAnimationFrame(() => setTimeout(() => setHydrated(true), 50));
    return () => cancelAnimationFrame(id);
  }, []);

  const statusColor = connectionStatus === 'offline' ? '#71717a' : !providerConnected ? '#f59e0b' : '#34d399';
  const statusTitle = connectionStatus === 'offline' ? 'Offline' : !providerConnected ? 'Online — connecting to provider…' : 'Connected';
  const statusGlow = connectionStatus === 'offline' ? 'none' : !providerConnected ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(52,211,153,0.5)';
  const navColor = (id: Module) => id === 'chat' ? '#a855f7' : id === 'exam' ? '#f59e0b' : id === 'analyst' ? '#3b82f6' : id === 'writer' ? '#ec4899' : id === 'planner' ? '#10b981' : id === 'agents' ? '#a855f7' : '#94a3b8';

  // Module switching moved into the left-swipe drawer (ProfileDrawer) so
  // this bar can stay a single fixed-height row instead of reserving space
  // for a dropdown that opened downward over the chat. When not on Chat,
  // a small non-interactive pill still names the current module so it's
  // not a total mystery which one you're in -- tap the avatar (or swipe
  // from the left edge) to switch.
  const cur = MODULES.find(m => m.id === currentModule) ?? MODULES[0];

  return (
    <header
      className="flex items-center justify-between px-4 py-2 shrink-0 relative z-[100] h-14 overflow-visible"
      style={{ opacity: hydrated ? 1 : 0, transition: 'opacity 0.25s ease' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-lg font-bold tracking-tight leading-none shrink-0" style={{ color: 'var(--gia-text)' }}>GIA</h1>
        {/* Module pill — always reserves ~72px so the header never shifts width
            when switching between chat (no pill) and other modules (pill visible).
            The pill fades in after hydration so the bar is stable from first paint. */}
        <div className="w-[72px] shrink-0" aria-hidden>
          {currentModule !== 'chat' && (
            <button
              onClick={() => setShowLeftDrawer(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap tap-feedback"
              style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: navColor(cur.id) }}
              title="Switch module"
            >
              <span className="shrink-0">{cur.icon}</span>
              <span>{cur.label}</span>
            </button>
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
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 tap-feedback" onClick={() => setShowLeftDrawer(true)} style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 12px rgba(168,85,247,0.4)', cursor: 'pointer' }} title="Profile & Settings">{userProfile.name ? userProfile.name[0].toUpperCase() : 'G'}</div>
      </div>
    </header>
  );
};

export default AppNavigation;
