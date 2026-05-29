import React, { useEffect, lazy, Suspense, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, BarChart2, PenLine, ListTodo, Settings, Bell, X, GraduationCap, Lock } from 'lucide-react';
import { useGiaStore, Module } from './store/useGiaStore';
import { useMemoryStore } from './store/useMemoryStore';
import { LocalNotifications } from '@capacitor/local-notifications';
import ChatModule from './modules/ChatModule';
import WriterModule from './modules/WriterModule';
import PlannerModule from './modules/PlannerModule';
import SettingsModule from './modules/SettingsModule';
import EngineRoom from './components/EngineRoom';
import ErrorBoundary from './components/ErrorBoundary';
import GiaConsole from './components/GiaConsole';
import ProtocolPanel from './components/ProtocolPanel';
import CommandPalette from './components/CommandPalette';
import SchedulerService from './services/SchedulerService';
import BiometricService from './services/BiometricService';
import MCPManager from './services/MCPManager';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import SystemService from './services/SystemService';
import { setSystemContext } from './services/GiaBrain';
import './styles/globals.css';

const AnalystModule = lazy(() => import('./modules/AnalystModule'));
const ExamModule = lazy(() => import('./modules/ExamModule'));

const MODULES: { id: Module; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'chat',     label: 'Chat',     icon: <MessageCircle size={18} />, color: 'var(--mod-chat)' },
  { id: 'exam',     label: 'Exam',     icon: <GraduationCap size={18} />, color: 'var(--mod-exam)' },
  { id: 'analyst',  label: 'Analyst',  icon: <BarChart2 size={18} />,    color: 'var(--mod-analyst)' },
  { id: 'writer',   label: 'Writer',   icon: <PenLine size={18} />,      color: 'var(--mod-writer)' },
  { id: 'planner',  label: 'Planner',  icon: <ListTodo size={18} />,     color: 'var(--mod-planner)' },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />,     color: 'var(--mod-settings)' },
];

const MODULE_GLOW: Record<Module, string> = {
  chat:     'var(--mod-chat)',
  exam:     'var(--mod-exam)',
  analyst:  'var(--mod-analyst)',
  writer:   'var(--mod-writer)',
  planner:  'var(--mod-planner)',
  settings: 'var(--mod-settings)',
};

const ModuleView: React.FC = () => {
  const { currentModule } = useGiaStore();
  const Fallback = () => (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-2">
        <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'var(--gia-border)', borderTopColor: '#a855f7' }} />
        <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>Loading...</span>
      </div>
    </div>
  );

  const components: Record<Module, React.ReactNode> = {
    chat:     <ErrorBoundary name="Chat"><ChatModule /></ErrorBoundary>,
    exam:     <Suspense fallback={<Fallback />}><ErrorBoundary name="Exam"><ExamModule /></ErrorBoundary></Suspense>,
    analyst:  <Suspense fallback={<Fallback />}><ErrorBoundary name="Analyst"><AnalystModule /></ErrorBoundary></Suspense>,
    writer:   <ErrorBoundary name="Writer"><WriterModule /></ErrorBoundary>,
    planner:  <ErrorBoundary name="Planner"><PlannerModule /></ErrorBoundary>,
    settings: <ErrorBoundary name="Settings"><SettingsModule /></ErrorBoundary>,
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentModule}
        initial={{ opacity: 0, y: 6, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="h-full w-full"
      >
        {components[currentModule]}
      </motion.div>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const { currentModule, setModule, showTerminal, userProfile, notifications, clearNotification, showConsole, consoleLogs, setShowConsole, showProtocols, setShowProtocols, theme, setTheme, createSession, addNotification } = useGiaStore();
  const [locked, setLocked] = useState(BiometricService.isLockEnabled());
  const [paletteOpen, setPaletteOpen] = useState(false);

  useKeyboardShortcuts([
    { key: 'k', meta: true, handler: () => setPaletteOpen(o => !o) },
    { key: 'n', meta: true, handler: () => { createSession(); addNotification('New session created'); } },
    { key: 's', meta: true, shift: true, handler: () => { setModule('settings'); } },
    { key: 'o', meta: true, shift: true, handler: () => { setShowProtocols(!showProtocols); } },
    { key: 'escape', handler: () => { if (paletteOpen) setPaletteOpen(false); } },
  ]);

  // Theme switching
  useEffect(() => {
    const applyTheme = (mode: string) => {
      const effective = mode === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : mode;
      document.documentElement.setAttribute('data-theme', effective);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective === 'light' ? '#f2f2f7' : '#0a0a0f');
    };
    applyTheme(theme);
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => { if (theme === 'system') applyTheme('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    LocalNotifications.requestPermissions();
    SchedulerService.start();
    MCPManager.init();

    // Deep system embedding — monitor battery, network, and feed into GIA context
    SystemService.getInfo().then(info => {
      setSystemContext(SystemService.formattedContext);
    });
    SystemService.startMonitoring().then(() => {
      setSystemContext(SystemService.formattedContext);
    });

    const t1 = setTimeout(() => useMemoryStore.getState().compactMemories(), 1000);
    const t2 = setTimeout(() => useGiaStore.getState().hibernateSessions(), 2000);
    if (locked) {
      handleBiometric();
    }
    return () => { clearTimeout(t1); clearTimeout(t2); MCPManager.shutdown(); SystemService.stopMonitoring(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBiometric = async () => {
    const ok = await BiometricService.verify();
    if (ok) setLocked(false);
  };

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];
    const timeout = setTimeout(() => clearNotification(latest.id), 5000);
    return () => clearTimeout(timeout);
  }, [notifications, clearNotification]);

  const activeColor = MODULE_GLOW[currentModule];

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 bg-zinc-950 px-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
          <Lock size={32} className="text-violet-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">GIA Workspace Locked</h2>
          <p className="text-sm text-zinc-500 mt-2">Biometric authentication is required to access your private workspace.</p>
        </div>
        <button 
          onClick={handleBiometric}
          className="gia-btn gia-btn-primary px-8 py-3 rounded-2xl font-semibold"
        >
          Authenticate
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      style={{ background: 'var(--gia-bg)' }}
    >
      {/* Global Notifications */}
      <div className="fixed top-16 left-0 right-0 z-[60] px-4 pointer-events-none space-y-2">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              className="gia-card p-3.5 flex items-start gap-3 pointer-events-auto shadow-2xl bg-zinc-900/95 backdrop-blur-xl border-zinc-800"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Bell size={14} className="text-emerald-400" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-[13px] font-medium text-zinc-100 leading-tight">{n.message}</p>
                <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-wider">Just now</p>
              </div>
              <button onClick={() => clearNotification(n.id)} className="text-zinc-600 hover:text-zinc-400 p-1">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Ambient background glow that shifts per module */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, rgba(${activeColor}, 0.06) 0%, transparent 70%)`,
          filter: 'blur(60px)',
          transition: 'background 0.6s ease',
          top: '-40px',
        }}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-lg font-bold tracking-tight leading-none"
              style={{ color: 'var(--gia-text)' }}
            >
              GIA
            </h1>
            <span
              className="gia-pill gia-pill-accent"
              style={{ fontSize: '8px', padding: '2px 6px' }}
            >
              v2.3.1.0
            </span>
          </div>
          <p
            className="text-[10px] mt-0.5 uppercase tracking-widest"
            style={{ color: 'var(--gia-muted)' }}
          >
            {userProfile.name ? `Hi ${userProfile.name}` : 'Personal AI Workspace'}
          </p>
        </div>

        {/* Avatar + Protocol Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProtocols(!showProtocols)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all text-[10px] font-bold"
            style={{
              background: showProtocols ? 'rgba(168,85,247,0.15)' : 'var(--gia-surface-2)',
              border: `1px solid ${showProtocols ? 'rgba(168,85,247,0.3)' : 'var(--gia-border)'}`,
              color: showProtocols ? '#a855f7' : 'var(--gia-muted)',
            }}
            title="Protocols"
          >
            ⚡
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
            style={{
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              boxShadow: '0 0 12px rgba(168,85,247,0.4)',
            }}
          >
            {userProfile.name ? userProfile.name[0].toUpperCase() : 'G'}
          </div>
        </div>
      </header>

      {/* Module content */}
      <main className="flex-1 overflow-hidden relative z-10">
        <ModuleView />
      </main>

      {/* Bottom nav */}
      <nav
        className="shrink-0 relative z-10"
        style={{
          background: 'rgba(17, 17, 24, 0.95)',
          borderTop: '1px solid var(--gia-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center">
          {MODULES.map((mod) => {
            const active = currentModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => setModule(mod.id)}
                className="flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-all relative tap-feedback"
                style={{ color: active ? 'white' : 'var(--gia-muted)' }}
              >
                {/* Active glow beneath icon */}
                {active && (
                  <div
                    className="absolute inset-0 rounded-none pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at 50% 100%, rgba(${mod.id === 'chat' ? '168,85,247' : mod.id === 'exam' ? '245,158,11' : mod.id === 'analyst' ? '59,130,246' : mod.id === 'writer' ? '236,72,153' : mod.id === 'planner' ? '16,185,129' : '148,163,184'}, 0.1) 0%, transparent 70%)`,
                    }}
                  />
                )}

                <motion.div
                  animate={{ scale: active ? 1.1 : 1, opacity: active ? 1 : 0.6 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    color: active
                      ? (mod.id === 'chat' ? '#a855f7' : mod.id === 'exam' ? '#f59e0b' : mod.id === 'analyst' ? '#3b82f6' : mod.id === 'writer' ? '#ec4899' : mod.id === 'planner' ? '#10b981' : '#94a3b8')
                      : 'var(--gia-muted)'
                  }}
                >
                  {mod.icon}
                </motion.div>

                <span
                  className="text-[9px] uppercase tracking-wider font-semibold"
                  style={{
                    color: active
                      ? (mod.id === 'chat' ? '#a855f7' : mod.id === 'exam' ? '#f59e0b' : mod.id === 'analyst' ? '#3b82f6' : mod.id === 'writer' ? '#ec4899' : mod.id === 'planner' ? '#10b981' : '#94a3b8')
                      : 'var(--gia-muted-2)'
                  }}
                >
                  {mod.label}
                </span>

                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                    style={{
                      width: '24px',
                      background: mod.id === 'chat' ? '#a855f7' : mod.id === 'exam' ? '#f59e0b' : mod.id === 'analyst' ? '#3b82f6' : mod.id === 'writer' ? '#ec4899' : mod.id === 'planner' ? '#10b981' : '#94a3b8',
                    }}
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Engine Room overlay */}
      <AnimatePresence>
        {showTerminal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
          >
            <EngineRoom />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConsole && (
          <GiaConsole
            logs={consoleLogs}
            isVisible={showConsole}
            onClose={() => setShowConsole(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProtocols && (
          <ProtocolPanel
            isVisible={showProtocols}
            onClose={() => setShowProtocols(false)}
          />
        )}
      </AnimatePresence>

      <CommandPalette 
        isOpen={paletteOpen} 
        onClose={() => setPaletteOpen(false)}
        onNavigate={(action) => {
          if (action === 'task-board') {
            // Task board is accessible via file browser or we can create a dedicated view
            setPaletteOpen(false);
            // For now, just notify - could add a dedicated task board view later
            useGiaStore.getState().addNotification('Task board: Use the folder icon in chat to access files, or create tasks via GIA');
          } else if (action === 'notes-panel') {
            setPaletteOpen(false);
            // For now, just notify - could add a dedicated notes view later
            useGiaStore.getState().addNotification('Notes: Use GIA to create, read, and manage notes via conversation');
          }
        }} 
      />
    </div>
  );
};

export default App;
