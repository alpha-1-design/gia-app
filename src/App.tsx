import React, { useEffect, lazy, Suspense, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, BarChart2, PenLine, ListTodo, Settings, Bell, X, GraduationCap, Lock, Cpu, Download, AlertCircle, Wifi, WifiOff, ChevronDown, Target, Bot } from 'lucide-react';
import { useGiaStore, Module } from './store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';
import { useMemoryStore } from './store/useMemoryStore';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapacitorApp } from '@capacitor/app';
import ChatModule from './modules/ChatModule';
import EngineRoom from './components/EngineRoom';
import ErrorBoundary from './components/ErrorBoundary';
import GiaConsole from './components/GiaConsole';
import ProtocolPanel from './components/ProtocolPanel';
import CommandPalette from './components/CommandPalette';
import { SourcesPanel } from './components/SourcesPanel';
import { RegionSelectorOverlay } from './components/RegionSelectorOverlay';
import { ScreenCaptureService } from './services/ScreenCaptureService';
import SchedulerService from './services/SchedulerService';
import BiometricService from './services/BiometricService';
import MCPManager from './services/MCPManager';
import { backgroundRecovery } from './services/BackgroundRecovery';
import SetupWizard from './components/SetupWizard';
import { proactiveEngine } from './services/autonomy/ProactiveEngine';
import { useAutonomyStore } from './store/useAutonomyStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import SystemService from './services/SystemService';
import { useProviderStore } from './store/useProviderStore';
import { providerRegistry } from './services/ProviderRegistry';
import { setSystemContext } from './services/GiaBrain';
import { logger } from './utils/logger';
import wakeLockService from './services/WakeLockService';
import keepaliveService from './services/KeepaliveService';
import idleManager from './services/IdleManager';
import LocalLLMService from './services/LocalLLMService';
import messagingBridge from './services/MessagingBridge';
import GiaBrain from './services/GiaBrain';
import giaForegroundService from './services/GIAForegroundService';
import { useShareTarget } from './hooks/useShareTarget';
import { useClipboardMonitor } from './hooks/useClipboardMonitor';
import { useNativeIntents } from './hooks/useNativeIntents';
import { ClipboardIcon } from 'lucide-react';
import './styles/globals.css';

const AnalystModule = lazy(() => import('./modules/AnalystModule'));
const ExamModule = lazy(() => import('./modules/ExamModule'));
const WriterModule = lazy(() => import('./modules/WriterModule'));
const PlannerModule = lazy(() => import('./modules/PlannerModule'));
const SettingsModule = lazy(() => import('./modules/SettingsModule'));
const AutonomyModule = lazy(() => import('./modules/AutonomyModule'));
const AgentsModule = lazy(() => import('./modules/AgentsModule'));

const MODULES: { id: Module; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'chat',     label: 'Chat',     icon: <MessageCircle size={18} />, color: 'var(--mod-chat)' },
  { id: 'exam',     label: 'Exam',     icon: <GraduationCap size={18} />, color: 'var(--mod-exam)' },
  { id: 'analyst',  label: 'Analyst',  icon: <BarChart2 size={18} />,    color: 'var(--mod-analyst)' },
  { id: 'writer',   label: 'Writer',   icon: <PenLine size={18} />,      color: 'var(--mod-writer)' },
  { id: 'planner',  label: 'Planner',  icon: <ListTodo size={18} />,     color: 'var(--mod-planner)' },
  { id: 'agents',   label: 'Agents',   icon: <Bot size={18} />,          color: 'var(--mod-agents)' },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />,     color: 'var(--mod-settings)' },
  { id: 'autonomy', label: 'Autonomy', icon: <Target size={18} />,       color: 'var(--mod-autonomy)' },
];

async function checkProviderHealth(provider: string, apiKey: string, model: string): Promise<boolean> {
  try {
    const baseUrl = providerRegistry.getBaseUrl(provider);
    if (!baseUrl) return false;
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
        signal: AbortSignal.timeout(10000),
      });
      return res.status === 200 || res.status === 400;
    }
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`, { signal: AbortSignal.timeout(10000) });
      return res.ok;
    }
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch (e) { logger.warn('[App] Provider health check failed:', e); return false; }
}

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
    writer:   <Suspense fallback={<Fallback />}><ErrorBoundary name="Writer"><WriterModule /></ErrorBoundary></Suspense>,
    planner:  <Suspense fallback={<Fallback />}><ErrorBoundary name="Planner"><PlannerModule /></ErrorBoundary></Suspense>,
    settings: <Suspense fallback={<Fallback />}><ErrorBoundary name="Settings"><SettingsModule /></ErrorBoundary></Suspense>,
    autonomy: <Suspense fallback={<Fallback />}><ErrorBoundary name="Autonomy"><AutonomyModule /></ErrorBoundary></Suspense>,
    agents:   <Suspense fallback={<Fallback />}><ErrorBoundary name="Agents"><AgentsModule /></ErrorBoundary></Suspense>,
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentModule}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="h-full w-full"
      >
        {components[currentModule]}
      </motion.div>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const { currentModule, setModule, showTerminal, userProfile, notifications, clearNotification, showConsole, consoleLogs, setShowConsole, showProtocols, setShowProtocols, theme, createSession, addNotification, connectionStatus, providerConnected, autoStartWakeWord } = useGiaStore(useShallow(s => ({
    currentModule: s.currentModule, setModule: s.setModule,
    showTerminal: s.showTerminal, userProfile: s.userProfile,
    notifications: s.notifications, clearNotification: s.clearNotification,
    showConsole: s.showConsole, consoleLogs: s.consoleLogs, setShowConsole: s.setShowConsole,
    showProtocols: s.showProtocols, setShowProtocols: s.setShowProtocols,
    theme: s.theme,
    createSession: s.createSession, addNotification: s.addNotification,
    connectionStatus: s.connectionStatus, providerConnected: s.providerConnected,
    autoStartWakeWord: s.autoStartWakeWord,
  })));
  const [locked, setLocked] = useState(BiometricService.isLockEnabled());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const moduleRef = useRef<HTMLDivElement>(null);
  const offsetSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const showCircleSearch = useGiaStore(s => s.showCircleSearch);
  const setShowCircleSearch = useGiaStore(s => s.setShowCircleSearch);
  const setPendingCircleImage = useGiaStore(s => s.setPendingCircleImage);
  const setModule_ = useGiaStore(s => s.setModule);

  // Trigger screen capture when circle search is activated
  useEffect(() => {
    if (!showCircleSearch) return;
    const start = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { GIAOverlay } = await import('./services/GIAOverlay');
          await GIAOverlay.startOverlay();
        } else {
          const dataUrl = await ScreenCaptureService.captureScreen();
          setCapturedImage(dataUrl);
        }
      } catch (e) {
        addNotification((e as Error).message || 'Screen capture failed');
        setShowCircleSearch(false);
      }
    };
    start();
  }, [showCircleSearch, addNotification, setShowCircleSearch]);

  const handleRegionSelect = useCallback((croppedUrl: string) => {
    setCapturedImage(null);
    setShowCircleSearch(false);
    setPendingCircleImage(croppedUrl);
    setModule_('chat');
    addNotification('Region captured! Analyzing with GIA...');
  }, [setShowCircleSearch, setPendingCircleImage, setModule_, addNotification]);

  const handleCircleCancel = useCallback(() => {
    setCapturedImage(null);
    setShowCircleSearch(false);
  }, [setShowCircleSearch]);

  // PWA share target
  const { sharedContent, applySharedContent } = useShareTarget();

  useEffect(() => {
    if (sharedContent) {
      addNotification('📩 Content shared to GIA');
      applySharedContent();
    }
  }, [sharedContent, addNotification, applySharedContent]);

  // Clipboard monitor — shows toast when interesting content is copied
  const { copiedText, dismissCopied, pasteCopied } = useClipboardMonitor();

  // Native Android intent handling (ASSIST, deep links, share target)
  useNativeIntents();

  // Register service worker for PWA + deep link detection
  useEffect(() => {
    const init = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          logger.log('[SW] Registered');

          // Listen for service worker messages (Telegram, share, etc.)
          navigator.serviceWorker.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg?.type) return;

            if (msg.type === 'gia-tg-status' && msg.lastUpdateId > 0) {
              // Sync app's offset to SW's (happens after configure)
              messagingBridge.syncOffset(Number(msg.lastUpdateId));
            }

            if (msg.type === 'gia-tg-missed-messages' && msg.messages?.length > 0) {
              logger.log(`[SW] Received ${msg.messages.length} missed Telegram messages`);
              for (const incoming of msg.messages) {
                const ctx = incoming.isGroup ? `group "${incoming.chatTitle}"` : 'DM';
                logger.log(`[Messaging] Missed ${ctx} from ${incoming.from}: ${incoming.text.slice(0, 80)}`);
                messagingBridge.handleIncomingFromSW(incoming);
              }
            }
          });

          // Check for missed Telegram messages cached by SW while we were away
          (async () => {
            try {
              const sw = registration.active || (await navigator.serviceWorker.ready).active;
              if (sw) sw.postMessage({ type: 'gia-tg-get-missed' });
            } catch (e) {
              logger.warn('[SW] Failed to request missed messages:', e);
            }
          })();
        } catch (e) {
          logger.warn('[SW] Registration failed:', e);
        }
      }

      // Configure status bar for proper safe-area rendering
      try {
        const { StatusBar } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: '#0a0a0f' });
      } catch { /* StatusBar plugin may not be available on web */ }

      // Deep link detection — handle ?url= param
      const params = new URLSearchParams(window.location.search);
      const deepLink = params.get('url');
      if (deepLink) {
        const decoded = decodeURIComponent(deepLink);
        const giaMatch = decoded.match(/^web\+gian:\/\/(.+)/);
        if (giaMatch) {
          const target = decodeURIComponent(giaMatch[1]);
          useGiaStore.getState().setPendingAction({
            type: 'deep-link',
            data: { url: target, raw: decoded },
          });
          useGiaStore.getState().addNotification(`🔗 Deep link received: ${target.slice(0, 40)}...`);
          useGiaStore.getState().setModule('chat');
          window.history.replaceState(null, '', '/');
        }
      }

      // Clipboard pasting detection — handle pasted gia:// links
      const handlePaste = (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text');
        if (text && text.startsWith('gia://')) {
          useGiaStore.getState().setPendingAction({
            type: 'deep-link',
            data: { url: text.replace('gia://', ''), raw: text },
          });
          useGiaStore.getState().addNotification('🔗 Pasted GIA link detected');
        }
      };
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    };
    init();

    // Show Setup Wizard if no provider is configured on first launch
    const { providers } = useProviderStore.getState();
    const hasAnyProvider = Object.values(providers).some(p => (p.enabled && p.apiKey) || (!p.enabled && p.apiKey && p.apiKey.length > 0));
    // Also check a localStorage flag as backup — the wizard stores 'gia-wizard-completed'
    const wizardCompleted = localStorage.getItem('gia-wizard-completed') === 'true';
    if (!hasAnyProvider && !wizardCompleted) {
      setShowSetup(true);
    }
  }, []);

  useKeyboardShortcuts([
    { key: 'k', meta: true, handler: () => setPaletteOpen(o => !o) },
    { key: 'n', meta: true, handler: () => { createSession(); addNotification('New session created'); } },
    { key: 's', meta: true, shift: true, handler: () => { setModule('settings'); } },
    { key: 'o', meta: true, shift: true, handler: () => { setShowProtocols(!showProtocols); } },
    { key: 'c', meta: true, shift: true, handler: () => { useGiaStore.getState().setShowCircleSearch(true); } },
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
    // Load provider definitions dynamically
    useProviderStore.getState().loadProviders().catch(e => logger.error('[App] Failed to load providers:', e));
    LocalNotifications.requestPermissions();
    SchedulerService.start();
    MCPManager.init();
    proactiveEngine.start();
    import('./services/GIACoreServices').then(m => m.giaCoreServices.onAppStart());

    // Track user activity for autonomy engine + idle manager
    const trackActivity = () => {
      useAutonomyStore.getState().setLastUserActivity();
      idleManager.ping();
    };
    window.addEventListener('mousedown', trackActivity);
    window.addEventListener('keydown', trackActivity);
    window.addEventListener('touchstart', trackActivity);
    import('./services/PluginManager').then(m => m.default.initialize());

    // Deep system embedding — monitor battery, network, and feed into GIA context
    SystemService.getInfo().then(() => {
      setSystemContext(SystemService.formattedContext);
    });
    SystemService.startMonitoring().then(() => {
      setSystemContext(SystemService.formattedContext);
    });

    // Connectivity monitoring
    const goOnline = () => {
      useGiaStore.getState().setConnectionStatus('online');
      useGiaStore.getState().addNotification('Back online');
    };
    const goOffline = () => {
      useGiaStore.getState().setConnectionStatus('offline');
      useGiaStore.getState().setProviderConnected(false);
      useGiaStore.getState().addNotification('No internet connection');
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    useGiaStore.getState().setConnectionStatus(navigator.onLine ? 'online' : 'offline');

    // Provider health check — ping the active provider to verify connectivity
    const checkProvider = async () => {
      const { providers, activeProvider } = useProviderStore.getState();
      const cfg = providers[activeProvider];
      if (!cfg?.apiKey || !navigator.onLine) {
        useGiaStore.getState().setProviderConnected(false);
        return;
      }
      checkProviderHealth(activeProvider, cfg.apiKey, cfg.model)
        .then(ok => useGiaStore.getState().setProviderConnected(ok))
        .catch(e => { logger.warn('[App] Provider health check network error:', e); useGiaStore.getState().setProviderConnected(false); });
    };
    setTimeout(checkProvider, 3000);

    const t1 = setTimeout(() => useMemoryStore.getState().compactMemories(), 1000);
    const t2 = setTimeout(() => useGiaStore.getState().hibernateSessions(), 2000);

    // Persistent notification — shows in Android notification tray while GIA is running
    const LONGRUNNING_NOTIF_ID = 9999;
    const showPersistentNotification = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const telegramLabel = messagingBridge.isConnected('telegram') ? ' • Telegram active' : '';
        await LocalNotifications.schedule({
          notifications: [{
            id: LONGRUNNING_NOTIF_ID,
            title: 'GIA is running',
            body: `Long-running mode${telegramLabel}`,
            ongoing: true,
            autoCancel: false,
          }],
        });
      } catch { /* noop */ }
    };
    const dismissPersistentNotification = async () => {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: LONGRUNNING_NOTIF_ID }] });
      } catch { /* noop */ }
    };

    // Long-running mode: wake lock + keepalive + idle model unload + messaging polling + fast autonomy
    const startLongRunning = async () => {
      if (!useGiaStore.getState().longRunningMode) return;
      await wakeLockService.start();
      await keepaliveService.start();
      idleManager.start(useGiaStore.getState().autoModelUnload ? 10 * 60 * 1000 : 30 * 60 * 1000);
      proactiveEngine.restartWithFastInterval();
      if (messagingBridge.isConnected('telegram')) {
        messagingBridge.startPolling();
      }
      // Start native foreground service (keeps WebView alive on Android)
      await giaForegroundService.start(true);
      await showPersistentNotification();
    };
    const stopLongRunning = async () => {
      await giaForegroundService.stop();
      await wakeLockService.stop();
      await keepaliveService.stop();
      idleManager.stop();
      await dismissPersistentNotification();
    };
    const unsubUnload = idleManager.onIdleTimeout(async () => {
      if (!useGiaStore.getState().autoModelUnload) return;
      logger.log('[IdleManager] Unloading idle models…');
      try { await LocalLLMService.unloadModel(); } catch { /* noop */ }
      try {
        const { default: whisper } = await import('./services/WhisperService');
        whisper.unload();
      } catch { /* noop */ }
    });
    const unsubActive = idleManager.onActiveAgain(() => {
      logger.log('[IdleManager] User active — models will reload on next use');
    });
    startLongRunning();
    const unsubLongRunning = useGiaStore.subscribe((s) => {
      if (s.longRunningMode) startLongRunning();
      else stopLongRunning();
    });

    // Configure SW polling for Telegram (runs regardless of long-running mode)
    // SW only polls when no clients are open, so it's safe to always configure
    if (messagingBridge.isConnected('telegram')) {
      messagingBridge.configureSWPolling();
      // Periodic offset sync to SW so it can continue seamlessly
      offsetSyncRef.current = setInterval(() => {
        messagingBridge.syncOffsetToSW();
      }, 30000);
    }

    // Messaging bridge — process incoming Telegram messages via GiaBrain
    const unsubMessage = messagingBridge.onMessage(async (incoming) => {
      const ctx = incoming.isGroup ? `group "${incoming.chatTitle}"` : 'DM';
      logger.log(`[Messaging] ${ctx} from ${incoming.from}: ${incoming.text.slice(0, 80)}`);
      try {
        const systemPrompt = incoming.isGroup
          ? `You are GIA, an AI assistant in the Telegram group "${incoming.chatTitle}". ${incoming.from} is speaking to you. Be helpful, concise, and natural. Address the whole group unless the message is directed at you personally. Keep responses brief — this is a group chat.`
          : `You are GIA, chatting with ${incoming.from} on Telegram. Be concise and natural. Respond conversationally.`;
        const res = await GiaBrain.generate({
          prompt: incoming.text,
          systemPrompt,
          onStream: undefined,
        });
        const reply = res.text;
        await messagingBridge.sendMessage({
          channel: incoming.channel,
          to: incoming.chatId,
          text: reply,
        });
        logger.log(`[Messaging] Replied to ${incoming.from} in ${ctx}`);
      } catch (e) {
        logger.error('[Messaging] Failed to process message:', e);
        await messagingBridge.sendMessage({
          channel: incoming.channel,
          to: incoming.chatId,
          text: 'Sorry, I hit an error. Try again in a moment.',
        }).catch(() => {});
      }
    });

    // Auto-start wake word listening if enabled
    if (autoStartWakeWord) {
      (async () => {
        try {
          const { GIAWakeWord } = await import('./services/GIAWakeWord');
          await GIAWakeWord.startListening();
          addNotification('Wake word listening enabled');
        } catch (e) {
          logger.error('[App] Auto-start wake word failed:', e);
        }
      })();
    }

    // Native Circle to Search overlay result handler
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { GIAOverlay } = await import('./services/GIAOverlay');
        await GIAOverlay.addListener('overlayResult', (result) => {
          if (result.cancelled) return;
          if (result.dataUrl) {
            setPendingCircleImage(result.dataUrl);
            if (result.text) useGiaStore.getState().setPendingInput(result.text);
            setModule('chat');
          } else if (result.text) {
            useGiaStore.getState().setPendingInput(result.text);
            setModule('chat');
          }
        });
      } catch (e) {
        logger.warn('[App] Native overlay setup failed:', e);
      }
    })();

    // Chain wake word → circle overlay + voice capture on native
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { GIAWakeWord } = await import('./services/GIAWakeWord');
        await GIAWakeWord.addListener('wakeWordDetected', async () => {
          try {
            const { GIAOverlay } = await import('./services/GIAOverlay');
            await GIAOverlay.startOverlay();

            // Auto-start voice capture after overlay appears
            setTimeout(async () => {
              try {
                const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition');
                const { available } = await SpeechRecognition.available();
                if (!available) return;

                const result = await SpeechRecognition.start({
                  language: 'en-US',
                  partialResults: false,
                  popup: false,
                });

                if (result?.matches?.length && result.matches[0]?.length > 0) {
                  const transcript = result.matches[0].replace(/[^\w\s']/g, '').trim();
                  if (transcript.length >= 2) {
                    useGiaStore.getState().setPendingInput(transcript);
                    useGiaStore.getState().setModule('chat');
                    await GIAOverlay.hideOverlay();
                  }
                }
              } catch (e) {
                logger.warn('[App] Voice capture after wake word failed:', e);
              }
            }, 600);
          } catch (e) {
            logger.warn('[App] Wake word overlay chaining failed:', e);
          }
        });
      } catch (e) {
        logger.warn('[App] Wake word overlay chain setup failed:', e);
      }
    })();

    // App lifecycle — persist + recover on resume
    backgroundRecovery.recover();
    const appStateHandle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        logger.log('[App] Backgrounded — state persisted');
      } else {
        backgroundRecovery.recover();
        logger.log('[App] Foreground — checking for interrupted tasks');
      }
    });

    if (locked) {
      handleBiometric();
    }
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('mousedown', trackActivity);
      window.removeEventListener('keydown', trackActivity);
      window.removeEventListener('touchstart', trackActivity);
      appStateHandle.then(h => h.remove());
      MCPManager.shutdown(); SystemService.stopMonitoring();
      proactiveEngine.stop();
      stopLongRunning();
      unsubUnload();
      unsubActive();
      unsubLongRunning();
      unsubMessage();
      messagingBridge.stopPolling();
      messagingBridge.stopSWPolling();
      if (offsetSyncRef.current) clearInterval(offsetSyncRef.current);
    };
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

  useEffect(() => {
    if (!moduleOpen) return;
    const handler = (e: MouseEvent) => {
      if (moduleRef.current && !moduleRef.current.contains(e.target as Node)) setModuleOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moduleOpen]);

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
          {notifications.map((n) => {
            const msg = n.message;
            const iconMap: [RegExp, React.ReactNode, string][] = [
              [/model|switch|provider|connected/i, <Cpu size={14} />, '#a855f7'],
              [/brain|memory|export|import/i, <Download size={14} />, '#8b5cf6'],
              [/error|fail|blocked/i, <AlertCircle size={14} />, '#f87171'],
              [/online|back online/i, <Wifi size={14} />, '#34d399'],
              [/offline|no internet/i, <WifiOff size={14} />, '#71717a'],
              [/notification|listen|voice/i, <Bell size={14} />, '#ec4899'],
            ];
            const match = iconMap.find(([re]) => re.test(msg));
            const icon = match ? match[1] : <Bell size={14} />;
            const color = match ? match[2] : '#34d399';
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                className="gia-card p-3.5 flex items-start gap-3 pointer-events-auto shadow-2xl bg-zinc-900/95 backdrop-blur-xl border-zinc-800"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
                  <span style={{ color }}>{icon}</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-[13px] font-medium text-zinc-100 leading-tight">{msg}</p>
                  <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-wider" style={{ color }}>Just now</p>
                </div>
                <button onClick={() => clearNotification(n.id)} className="text-zinc-600 hover:text-zinc-400 p-1">
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 relative z-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <h1
              className="text-lg font-bold tracking-tight leading-none"
              style={{ color: 'var(--gia-text)' }}
            >
              GIA
            </h1>
          </div>

          {/* Module selector pill */}
          <div ref={moduleRef} className="relative">
            {(() => {
              const cur = MODULES.find(m => m.id === currentModule)!;
              return (
                <>
                  <button
                    onClick={() => setModuleOpen(o => !o)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap tap-feedback"
                    style={{
                      background: 'var(--gia-surface-2)',
                      border: '1px solid var(--gia-border)',
                      color: cur.id === 'chat' ? '#a855f7' : cur.id === 'exam' ? '#f59e0b' : cur.id === 'analyst' ? '#3b82f6' : cur.id === 'writer' ? '#ec4899' : cur.id === 'planner' ? '#10b981' : cur.id === 'agents' ? '#a855f7' : '#94a3b8',
                    }}
                  >
                    <span className="shrink-0">{cur.icon}</span>
                    <span className="hidden sm:inline">{cur.label}</span>
                    <ChevronDown size={12} className={`transition-transform ${moduleOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {moduleOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-full left-0 mt-1 min-w-[160px] rounded-xl overflow-hidden shadow-2xl border z-50"
                      style={{
                        background: 'rgba(20, 20, 28, 0.98)',
                        borderColor: 'var(--gia-border)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                      }}
                    >
                      {MODULES.map((mod) => {
                        const active = currentModule === mod.id;
                        return (
                          <button
                            key={mod.id}
                            onClick={() => { setModule(mod.id); setModuleOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] font-medium transition-all tap-feedback"
                            style={{
                              color: active ? 'white' : 'var(--gia-muted)',
                              background: active ? 'rgba(168,85,247,0.1)' : 'transparent',
                            }}
                          >
                            <span style={{ color: mod.id === 'chat' ? '#a855f7' : mod.id === 'exam' ? '#f59e0b' : mod.id === 'analyst' ? '#3b82f6' : mod.id === 'writer' ? '#ec4899' : mod.id === 'planner' ? '#10b981' : mod.id === 'agents' ? '#a855f7' : '#94a3b8' }}>
                              {mod.icon}
                            </span>
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

        {/* Avatar + Status */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: connectionStatus === 'offline'
                ? '#71717a'
                : !providerConnected
                  ? '#f59e0b'
                  : '#34d399',
              boxShadow: connectionStatus === 'offline'
                ? 'none'
                : !providerConnected
                  ? '0 0 6px rgba(245,158,11,0.5)'
                  : '0 0 6px rgba(52,211,153,0.5)',
            }}
            title={
              connectionStatus === 'offline'
                ? 'Offline'
                : !providerConnected
                  ? 'Online — connecting to provider…'
                  : 'Connected'
            }
          />
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

      {/* Clipboard toast */}
      <AnimatePresence>
        {copiedText && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 right-4 z-50 max-w-md mx-auto"
          >
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
              style={{
                background: 'rgba(20,20,30,0.95)',
                border: '1px solid rgba(168,85,247,0.2)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <ClipboardIcon size={16} className="text-violet-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-zinc-400">Copied to clipboard</p>
                <p className="text-xs text-zinc-200 truncate">{copiedText.slice(0, 100)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={pasteCopied}
                  className="text-[10px] font-semibold px-3 py-1.5 rounded-xl transition-all"
                  style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7' }}
                >
                  Ask GIA
                </button>
                <button
                  onClick={dismissCopied}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <AnimatePresence>
        {showSetup && <SetupWizard onClose={() => setShowSetup(false)} onComplete={() => setShowSetup(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showCircleSearch && capturedImage && (
          <RegionSelectorOverlay
            imageSrc={capturedImage}
            onSelect={handleRegionSelect}
            onCancel={handleCircleCancel}
          />
        )}
      </AnimatePresence>

      <SourcesPanel />
    </div>
  );
};

export default App;
