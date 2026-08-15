import React, { useEffect, lazy, Suspense, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X, Lock, Cpu, Download, AlertCircle, Wifi, WifiOff, ClipboardIcon } from 'lucide-react';
import { useGiaStore, Module } from './store/useGiaStore';
import { setStorageErrorHandler } from './store/idb-storage';
import { useShallow } from 'zustand/react/shallow';
import { useMemoryStore } from './store/useMemoryStore';
import { useAutonomyStore } from './store/useAutonomyStore';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import ChatModule from './modules/ChatModule';
import WriterModule from './modules/WriterModule';
import PlannerModule from './modules/PlannerModule';
import SettingsModule from './modules/SettingsModule';
import ErrorBoundary from './components/ErrorBoundary';
import ApiKeyInputPanel from './components/ApiKeyInputPanel';
import { SourcesPanel } from './components/SourcesPanel';
import AppNavigation from './components/AppNavigation';
import BiometricService from './services/BiometricService';
import { useProviderStore } from './store/useProviderStore';
import { logger } from './utils/logger';
import { useShareTarget } from './hooks/useShareTarget';
import { useClipboardMonitor } from './hooks/useClipboardMonitor';
import { useNativeIntents } from './hooks/useNativeIntents';
import { useAutomationBridge } from './hooks/useAutomationBridge';
import type { UpdateInfo } from './services/UpdateService';
import './styles/globals.css';

const EngineRoom = lazy(() => import('./components/EngineRoom'));
const GiaConsole = lazy(() => import('./components/GiaConsole'));
const ProtocolPanel = lazy(() => import('./components/ProtocolPanel'));
const TaskBoard = lazy(() => import('./components/TaskBoard').then(m => ({ default: m.TaskBoard })));
const NotesPanel = lazy(() => import('./components/NotesPanel').then(m => ({ default: m.NotesPanel })));
const RegionSelectorOverlay = lazy(() => import('./components/RegionSelectorOverlay').then(m => ({ default: m.RegionSelectorOverlay })));
const SetupWizard = lazy(() => import('./components/SetupWizard'));

// Surface persistence failures (e.g. storage quota exceeded) to the user
// instead of failing silently and losing data. Throttled so a persistent
// failure can't flood the notification stack.
let lastStorageWarn = 0;
if (typeof window !== 'undefined') {
  setStorageErrorHandler(({ key, error }) => {
    logger.error('[storage] persistence failure:', key, error);
    const now = Date.now();
    if (now - lastStorageWarn > 10000) {
      lastStorageWarn = now;
      useGiaStore.getState().addNotification(
        '⚠️ Storage unavailable — recent changes may not be saved. Free up device space and reload.',
      );
    }
  });
}

const AnalystModule = lazy(() => import('./modules/AnalystModule'));
const ExamModule = lazy(() => import('./modules/ExamModule'));
const AutonomyModule = lazy(() => import('./modules/AutonomyModule'));
const AgentsModule = lazy(() => import('./modules/AgentsModule'));

async function checkProviderHealth(provider: string, apiKey: string, model: string): Promise<boolean> {
  try {
    const { providerRegistry } = await import('./services/ProviderRegistry');
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
  const currentModule = useGiaStore(s => s.currentModule);
  const Fallback = () => (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-2">
        <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'var(--gia-border)', borderTopColor: '#a855f7' }} />
        <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>Loading...</span>
      </div>
    </div>
  );

  const components: Record<Module, React.ReactNode> = {
    chat:      <ErrorBoundary name="Chat"><ChatModule /></ErrorBoundary>,
    exam:      <Suspense fallback={<Fallback />}><ErrorBoundary name="Exam"><ExamModule /></ErrorBoundary></Suspense>,
    analyst:   <Suspense fallback={<Fallback />}><ErrorBoundary name="Analyst"><AnalystModule /></ErrorBoundary></Suspense>,
    writer:    <ErrorBoundary name="Writer"><WriterModule /></ErrorBoundary>,
    planner:   <ErrorBoundary name="Planner"><PlannerModule /></ErrorBoundary>,
    settings:  <ErrorBoundary name="Settings"><SettingsModule /></ErrorBoundary>,
    autonomy:  <Suspense fallback={<Fallback />}><ErrorBoundary name="Autonomy"><AutonomyModule /></ErrorBoundary></Suspense>,
    agents:    <Suspense fallback={<Fallback />}><ErrorBoundary name="Agents"><AgentsModule /></ErrorBoundary></Suspense>,
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
        {components[currentModule] ?? components.chat}
      </motion.div>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const { setModule, showTerminal, setShowTerminal, notifications, clearNotification, showConsole, consoleLogs, setShowConsole, showProtocols, setShowProtocols, theme, addNotification, autoStartWakeWord, fullScreenMode } = useGiaStore(useShallow(s => ({
      setModule: s.setModule,
      showTerminal: s.showTerminal, setShowTerminal: s.setShowTerminal,
      notifications: s.notifications, clearNotification: s.clearNotification,
      showConsole: s.showConsole, consoleLogs: s.consoleLogs, setShowConsole: s.setShowConsole,
      showProtocols: s.showProtocols, setShowProtocols: s.setShowProtocols,
      theme: s.theme,
      addNotification: s.addNotification,
      autoStartWakeWord: s.autoStartWakeWord,
      fullScreenMode: s.fullScreenMode,
    })));
  const [locked, setLocked] = useState(BiometricService.isLockEnabled());

  // Hardware Back button (Android): close top overlay → back through module
  // history → "press again to exit" at root. A ref keeps the native listener
  // (registered once) reading the latest React state. Must be declared before
  // any early return (below) to satisfy the rules of hooks.
  const backActionRef = useRef<() => void>(() => {});
  const lastBackTsRef = useRef(0);
  backActionRef.current = () => {
    const st = useGiaStore.getState();
    if (st.showModelSwitcher) { st.setShowModelSwitcher(false); return; }
    if (st.showEngine) { st.setShowEngine(false); return; }
    if (st.showProtocols) { st.setShowProtocols(false); return; }
    if (showTerminal) { setShowTerminal(false); return; }
    if (st.currentModule !== 'chat') { st.goBack(); return; }
    const now = Date.now();
    if (now - lastBackTsRef.current < 2000) { CapacitorApp.exitApp(); }
    else { lastBackTsRef.current = now; st.addNotification('Press back again to exit'); }
  };
  useEffect(() => {
    const handle = CapacitorApp.addListener('backButton', () => backActionRef.current());
    return () => { handle.then(h => h.remove()); };
  }, []);

  // Deep link handling for Android (Capacitor appUrlOpen)
  useEffect(() => {
    const handle = CapacitorApp.addListener('appUrlOpen', (event: { url: string }) => {
      const url = event.url;
      if (url.startsWith('gia://')) {
        const target = url.replace('gia://', '');
        useGiaStore.getState().setPendingAction({
          type: 'deep-link',
          data: { url: target, raw: url },
        });
        useGiaStore.getState().addNotification(`🔗 Deep link received: ${target.slice(0, 40)}...`);
        useGiaStore.getState().setModule('chat');
      }
    });
    return () => { handle.then(h => h.remove()); };
  }, []);
  const [showTaskBoard, setShowTaskBoard] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [updateNotification, setUpdateNotification] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
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
          const { ScreenCaptureService } = await import('./services/ScreenCaptureService');
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
  useAutomationBridge();

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
              import('./services/MessagingBridge').then(m => m.default.syncOffset(Number(msg.lastUpdateId)));
            }

            if (msg.type === 'gia-tg-missed-messages' && msg.messages?.length > 0) {
              logger.log(`[SW] Received ${msg.messages.length} missed Telegram messages`);
              for (const incoming of msg.messages) {
                const ctx = incoming.isGroup ? `group "${incoming.chatTitle}"` : 'DM';
                logger.log(`[Messaging] Missed ${ctx} from ${incoming.from}: ${incoming.text.slice(0, 80)}`);
                import('./services/MessagingBridge').then(m => m.default.handleIncomingFromSW(incoming));
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

      return () => document.removeEventListener('paste', handlePaste);
    };
    init();

    // Show Setup Wizard if no provider is configured on first launch
    const { providers } = useProviderStore.getState();
    const hasAnyProvider = Object.values(providers).some(p => (p.enabled && p.apiKey) || (!p.enabled && p.apiKey && p.apiKey.length > 0));
    const wizardCompleted = localStorage.getItem('gia-wizard-completed') === 'true';
    if (!hasAnyProvider && !wizardCompleted) {
      setShowSetup(true);
    }

    // Clipboard paste detection (synchronous — cleaned up properly)
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
  }, []);

  // Theme switching
  useEffect(() => {
    const applyTheme = (mode: string) => {
      const effective = mode === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : mode;
      document.documentElement.setAttribute('data-theme', effective);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective === 'light' ? '#f2f2f7' : effective === 'obsidian-aurora' ? '#000000' : '#0a0a0f');
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
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions().catch(() => {});
    }

    // Register all tool definitions into the ToolRegistry singleton
    import('./services/tools/index').then(m => m.registerAllTools());

    // Lazy-loaded service singletons — resolved in parallel, none block first paint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let svc: Record<string, any> | null = null;
    const servicesReady = Promise.all([
      import('./services/SchedulerService').then(m => { m.default.start(); }),
      import('./services/WidgetSyncService').then(m => { m.default.start(); }),
      import('./services/MCPManager').then(m => m.default),
      import('./services/autonomy/ProactiveEngine').then(m => { m.proactiveEngine.start(); return m.proactiveEngine; }),
      import('./services/IdleManager').then(m => m.default),
      import('./services/SystemService').then(m => m.default),
      import('./services/GiaBrain').then(m => m.setSystemContext),
      import('./services/WakeLockService').then(m => m.default),
      import('./services/KeepaliveService').then(m => m.default),
      import('./services/GIAForegroundService').then(m => m.default),
      import('./services/MessagingBridge').then(m => m.default),
      import('./services/BackgroundRecovery').then(m => m.backgroundRecovery),
    ]).then(([, , MCPManager, proactiveEngine, idleManager, SystemService, setSystemContext, wakeLockService, keepaliveService, giaForegroundService, messagingBridge, backgroundRecovery]) => {
      svc = { idleManager, SystemService, setSystemContext, wakeLockService, keepaliveService, giaForegroundService, messagingBridge, backgroundRecovery, proactiveEngine, MCPManager };
      return svc;
    });

    import('./services/GIACoreServices').then(m => m.giaCoreServices.onAppStart());

    // Track user activity for autonomy engine + idle manager
    const trackActivity = () => {
      useAutonomyStore.getState().setLastUserActivity();
      if (svc) svc.idleManager.ping();
    };
    window.addEventListener('mousedown', trackActivity);
    window.addEventListener('keydown', trackActivity);
    window.addEventListener('touchstart', trackActivity);
    import('./services/PluginManager').then(m => m.default.initialize());

    // Deep system embedding — monitor battery, network, and feed into GIA context
    servicesReady.then(({ SystemService, setSystemContext }) => {
      SystemService.getInfo().then(() => setSystemContext(SystemService.formattedContext));
      SystemService.startMonitoring().then(() => setSystemContext(SystemService.formattedContext));
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

    // Check for app updates on startup (only if not dismissed)
    if (!updateDismissed) {
      setTimeout(async () => {
        try {
          const { updateService } = await import('./services/UpdateService');
          const info = await updateService.checkForUpdate();
          if (info) setUpdateNotification(info);
        } catch { /* ignore */ }
      }, 4000);
    }

    // Persistent notification — shows in Android notification tray while GIA is running
    const LONGRUNNING_NOTIF_ID = 9999;
    const showPersistentNotification = async (messagingBridge: { isConnected: (ch: string) => boolean }) => {
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
    const cleanupFns: (() => void)[] = [];
    servicesReady.then(({ wakeLockService, keepaliveService, idleManager, proactiveEngine, messagingBridge, giaForegroundService }) => {
      const startLongRunning = async () => {
        if (!useGiaStore.getState().longRunningMode) return;
        await wakeLockService.start();
        await keepaliveService.start();
        idleManager.start(useGiaStore.getState().autoModelUnload ? 10 * 60 * 1000 : 30 * 60 * 1000);
        proactiveEngine.restartWithFastInterval();
        if (messagingBridge.isConnected('telegram')) {
          messagingBridge.startPolling();
        }
        await giaForegroundService.start(true);
        await showPersistentNotification(messagingBridge);
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
        try { const { default: llm } = await import('./services/LocalLLMService'); await llm.unloadModel(); } catch { /* noop */ }
        try { const { default: whisper } = await import('./services/WhisperService'); whisper.unload(); } catch { /* noop */ }
      });
      const unsubActive = idleManager.onActiveAgain(() => {
        logger.log('[IdleManager] User active — models will reload on next use');
      });
      startLongRunning();
      const unsubLongRunning = useGiaStore.subscribe((s) => {
        if (s.longRunningMode) startLongRunning();
        else stopLongRunning();
      });

      // Configure SW polling for Telegram
      if (messagingBridge.isConnected('telegram')) {
        messagingBridge.configureSWPolling();
        offsetSyncRef.current = setInterval(() => {
          messagingBridge.syncOffsetToSW();
        }, 30000);
      }

      // Messaging bridge — process incoming Telegram messages via GiaBrain
      const unsubMessage = messagingBridge.onMessage(async (incoming: { isGroup: boolean; chatTitle: string; from: string; text: string; channel: string; chatId: string }) => {
        const ctx = incoming.isGroup ? `group "${incoming.chatTitle}"` : 'DM';
        logger.log(`[Messaging] ${ctx} from ${incoming.from}: ${incoming.text.slice(0, 80)}`);
        try {
          const { default: GiaBrain } = await import('./services/GiaBrain');
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

      cleanupFns.push(
        () => { unsubUnload(); unsubActive(); unsubLongRunning(); unsubMessage(); messagingBridge.stopPolling(); messagingBridge.stopSWPolling(); },
      );
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
    let overlayHandle: Promise<{ remove: () => void }> | undefined;
    let wakeHandle: Promise<{ remove: () => void }> | undefined;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { GIAOverlay } = await import('./services/GIAOverlay');
        overlayHandle = GIAOverlay.addListener('overlayResult', (result: { cancelled?: boolean; dataUrl?: string; text?: string }) => {
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
        wakeHandle = GIAWakeWord.addListener('wakeWordDetected', async () => {
          try {
            const { GIAOverlay } = await import('./services/GIAOverlay');
            await GIAOverlay.startOverlay();

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
    servicesReady.then(s => s.backgroundRecovery.recover());
    const appStateHandle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        logger.log('[App] Backgrounded — state persisted');
      } else {
        servicesReady.then(s => s.backgroundRecovery.recover());
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
      if (overlayHandle) overlayHandle.then(h => h.remove()).catch(() => {});
      if (wakeHandle) wakeHandle.then(h => h.remove()).catch(() => {});
      if (svc) { svc.MCPManager.shutdown(); svc.SystemService.stopMonitoring(); svc.proactiveEngine.stop(); }
      for (const fn of cleanupFns) fn();
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
       {!fullScreenMode && <AppNavigation />}

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

      {/* Update notification slide-up */}
      <AnimatePresence>
        {updateNotification && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-24 left-4 right-4 z-50 max-w-md mx-auto"
          >
            <div
              className="flex items-start gap-3 px-4 py-4 rounded-2xl shadow-2xl"
              style={{
                background: 'rgba(15, 15, 22, 0.98)',
                border: '1px solid rgba(52,211,153,0.3)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(52,211,153,0.1), inset 0 1px 0 rgba(52,211,153,0.08)',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.1))', border: '1px solid rgba(52,211,153,0.25)' }}>
                <Download size={20} style={{ color: '#34d399' }} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-semibold" style={{ color: '#e5e7eb' }}>Update Available</p>
                <p className="text-xs mt-1" style={{ color: 'var(--gia-muted)' }}>
                  v{updateNotification.version} · {updateNotification.size ? (updateNotification.size / (1024*1024)).toFixed(1) + ' MB' : 'Download'}
                </p>
                <p className="text-[10px] mt-2" style={{ color: 'var(--gia-muted-2)' }}>
                  {updateNotification.releaseName}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => { setModule('settings'); setUpdateNotification(null); }}
                  className="px-3.5 py-1.5 rounded-xl text-[10px] font-semibold whitespace-nowrap transition-all"
                  style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.1))', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}
                >
                  Update
                </button>
                <button
                  onClick={() => { setUpdateNotification(null); setUpdateDismissed(true); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-600 hover:text-zinc-400 transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <X size={14} />
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

      {showTaskBoard && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTaskBoard(false)}>
          <div className="relative rounded-2xl w-full max-w-4xl h-[80vh] overflow-hidden shadow-2xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTaskBoard(false)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-lg hover:bg-black/10 transition-colors"
              style={{ color: 'var(--gia-muted)' }}
              aria-label="Close task board"
            >
              <X size={16} />
            </button>
            <TaskBoard />
          </div>
        </div>
      )}
      {showNotesPanel && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNotesPanel(false)}>
          <div className="relative rounded-2xl w-full max-w-2xl h-[80vh] overflow-hidden shadow-2xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowNotesPanel(false)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-lg hover:bg-black/10 transition-colors"
              style={{ color: 'var(--gia-muted)' }}
              aria-label="Close notes"
            >
              <X size={16} />
            </button>
            <NotesPanel />
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSetup && (
          <motion.div
            key="setup-wizard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] w-full h-[100dvh] bg-[var(--gia-bg)] flex flex-col overflow-y-auto"
          >
            <SetupWizard onClose={() => setShowSetup(false)} onComplete={() => setShowSetup(false)} />
          </motion.div>
        )}
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
      <ApiKeyInputPanel />
    </div>
  );
};

export default App;
