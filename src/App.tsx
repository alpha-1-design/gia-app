import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, BarChart2, PenLine, ListTodo, Settings } from 'lucide-react';
import { useGiaStore, Module } from './store/useGiaStore';
import ChatModule from './modules/ChatModule';
import WriterModule from './modules/WriterModule';
import AnalystModule from './modules/AnalystModule';
import PlannerModule from './modules/PlannerModule';
import SettingsModule from './modules/SettingsModule';
import EngineRoom from './components/EngineRoom';
import './styles/globals.css';

const MODULES: { id: Module; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'chat',     label: 'Chat',     icon: <MessageCircle size={18} />, color: 'var(--mod-chat)' },
  { id: 'analyst',  label: 'Analyst',  icon: <BarChart2 size={18} />,    color: 'var(--mod-analyst)' },
  { id: 'writer',   label: 'Writer',   icon: <PenLine size={18} />,      color: 'var(--mod-writer)' },
  { id: 'planner',  label: 'Planner',  icon: <ListTodo size={18} />,     color: 'var(--mod-planner)' },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />,     color: 'var(--mod-settings)' },
];

const MODULE_GLOW: Record<Module, string> = {
  chat:     'var(--mod-chat)',
  analyst:  'var(--mod-analyst)',
  writer:   'var(--mod-writer)',
  planner:  'var(--mod-planner)',
  settings: 'var(--mod-settings)',
};

const ModuleView: React.FC = () => {
  const { currentModule } = useGiaStore();
  const components: Record<Module, React.ReactNode> = {
    chat:     <ChatModule />,
    analyst:  <AnalystModule />,
    writer:   <WriterModule />,
    planner:  <PlannerModule />,
    settings: <SettingsModule />,
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
  const { currentModule, setModule, showTerminal, userProfile, hibernateSessions } = useGiaStore();

  useEffect(() => {
    hibernateSessions();
    const interval = setInterval(hibernateSessions, 300_000);
    return () => clearInterval(interval);
  }, [hibernateSessions]);

  const activeColor = MODULE_GLOW[currentModule];

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      style={{ background: 'var(--gia-bg)' }}
    >
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
              v2.2
            </span>
          </div>
          <p
            className="text-[10px] mt-0.5 uppercase tracking-widest"
            style={{ color: 'var(--gia-muted)' }}
          >
            {userProfile.name ? `Hi ${userProfile.name}` : 'Personal AI Workspace'}
          </p>
        </div>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
          style={{
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            boxShadow: '0 0 12px rgba(168,85,247,0.4)',
          }}
        >
          {userProfile.name ? userProfile.name[0].toUpperCase() : 'G'}
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
            const rgbColor = mod.color.replace('var(--mod-', '').replace(')', '');
            const cssVar = `var(--mod-${rgbColor})`;

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
                      background: `radial-gradient(ellipse at 50% 100%, rgba(${mod.id === 'chat' ? '168,85,247' : mod.id === 'analyst' ? '59,130,246' : mod.id === 'writer' ? '236,72,153' : mod.id === 'planner' ? '16,185,129' : '148,163,184'}, 0.1) 0%, transparent 70%)`,
                    }}
                  />
                )}

                <motion.div
                  animate={{ scale: active ? 1.1 : 1, opacity: active ? 1 : 0.6 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    color: active
                      ? (mod.id === 'chat' ? '#a855f7' : mod.id === 'analyst' ? '#3b82f6' : mod.id === 'writer' ? '#ec4899' : mod.id === 'planner' ? '#10b981' : '#94a3b8')
                      : 'var(--gia-muted)'
                  }}
                >
                  {mod.icon}
                </motion.div>

                <span
                  className="text-[9px] uppercase tracking-wider font-semibold"
                  style={{
                    color: active
                      ? (mod.id === 'chat' ? '#a855f7' : mod.id === 'analyst' ? '#3b82f6' : mod.id === 'writer' ? '#ec4899' : mod.id === 'planner' ? '#10b981' : '#94a3b8')
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
                      background: mod.id === 'chat' ? '#a855f7' : mod.id === 'analyst' ? '#3b82f6' : mod.id === 'writer' ? '#ec4899' : mod.id === 'planner' ? '#10b981' : '#94a3b8',
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
    </div>
  );
};

export default App;
