import React, { useState, useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { clsx } from 'clsx';
import {
  Activity,
  CheckCircle2,
  Loader2,
  X,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Clipboard,
  Wifi,
  WifiOff,
  Plus,
} from 'lucide-react';
import { idbStorage } from '../store/idb-storage';
import { providerRegistry } from '../services/ProviderRegistry';
import { useProviderStore, type ModelOption } from '../store/useProviderStore';
import { corsProxy } from '../services/CorsProxy';
import { useCustomProviderStore, validateCustomProvider, getAllProvidersWithCustom } from '../services/providers/customProviders';
import { useGiaStore } from '../store/useGiaStore';

// ─── Wizard State Store ───────────────────────────────────────────────

type WizardStepId = 'welcome' | 'select-provider' | 'enter-key' | 'test-connection' | 'select-model' | 'done';

interface TestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
  models?: string[];
}

interface WizardState {
  step: WizardStepId;
  provider: string;
  apiKey: string;
  model: string;
  testResult: TestResult | null;
  isCustom: boolean;
  customProviderId: string;
  setStep: (step: WizardStepId) => void;
  setProvider: (provider: string) => void;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setTestResult: (result: TestResult | null) => void;
  setIsCustom: (custom: boolean) => void;
  setCustomProviderId: (id: string) => void;
  reset: () => void;
}

const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      step: 'welcome',
      provider: '',
      apiKey: '',
      model: '',
      testResult: null,
      isCustom: false,
      customProviderId: '',
      setStep: (step) => set({ step }),
      setProvider: (provider) => set({ provider, testResult: null }),
      setApiKey: (apiKey) => set({ apiKey, testResult: null }),
      setModel: (model) => set({ model }),
      setTestResult: (result) => set({ testResult: result }),
      setIsCustom: (isCustom) => set({ isCustom }),
      setCustomProviderId: (id) => set({ customProviderId: id }),
      reset: () =>
        set({
          step: 'welcome',
          provider: '',
          apiKey: '',
          model: '',
          testResult: null,
          isCustom: false,
          customProviderId: '',
        }),
    }),
    {
      name: 'gia-wizard-state',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        provider: s.provider,
        apiKey: s.apiKey,
        model: s.model,
        isCustom: s.isCustom,
        customProviderId: s.customProviderId,
      }),
    }
  )
);

// ─── Component ────────────────────────────────────────────────────────

interface SetupWizardProps {
  onClose?: () => void;
  onComplete?: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onClose, onComplete }) => {
  const wizard = useWizardStore();
  const { setProviderKey, setProviderModel, setActiveProvider, fetchModels } = useProviderStore();
  const { addCustomProvider } = useCustomProviderStore();
  const { setShowTerminal } = useGiaStore();
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [fetchedModels, setFetchedModels] = useState<ModelOption[]>([]);
  const [busy, setBusy] = useState(false);

  // Custom provider form state
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  const resetWizard = useCallback(() => {
    wizard.reset();
    setShowKey(false);
    setKeyError('');
    setFetchedModels([]);
    setCustomName('');
    setCustomBaseUrl('');
    setCustomApiKey('');
    setShowCustomForm(false);
  }, [wizard]);

  const handleClose = useCallback(() => {
    localStorage.setItem('gia-wizard-completed', 'true');
    resetWizard();
    onClose?.();
  }, [resetWizard, onClose]);

  const runTest = useCallback(async () => {
    if (wizard.step !== 'test-connection') return;
    setTesting(true);
    wizard.setTestResult(null);

    try {
      const start = performance.now();
      const def = providerRegistry.getProvider(wizard.provider);

      if (!def) {
        const cp = useCustomProviderStore.getState().customProviders.find(
          (c) => c.id === wizard.provider
        );
        if (cp) {
          const result = await validateCustomProvider(cp);
          const elapsed = Math.round(performance.now() - start);
          if (result.valid) {
            wizard.setTestResult({
              success: true,
              latencyMs: elapsed,
              models: result.models,
            });
          } else {
            wizard.setTestResult({
              success: false,
              error: result.error || 'Connection failed',
            });
          }
        } else {
          wizard.setTestResult({ success: false, error: 'Provider not found' });
        }
      } else {
        const baseUrl = def.baseUrl;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (wizard.apiKey) {
          headers['Authorization'] = `Bearer ${wizard.apiKey}`;
        }
        if (def.headers) Object.assign(headers, def.headers);

        const isLocal = !def.needsApiKey;
        const fetchFn = isLocal ? fetch : corsProxy.fetch;

        const res = await fetchFn(`${baseUrl}/models`, {
          headers,
          signal: AbortSignal.timeout(10000),
        });

        const elapsed = Math.round(performance.now() - start);

        if (res.ok) {
          const json = await res.json();
          const modelList = json.data ?? json.models ?? [];
          const modelNames = modelList.map((m: { id?: string; name?: string }) => m.id || m.name || '');
          wizard.setTestResult({ success: true, latencyMs: elapsed, models: modelNames });
        } else {
          wizard.setTestResult({
            success: false,
            error: `HTTP ${res.status}: ${res.statusText}`,
          });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      wizard.setTestResult({ success: false, error: msg });
    } finally {
      setTesting(false);
    }
  }, [wizard]);

  useEffect(() => {
    if (wizard.step === 'test-connection' && !wizard.testResult && !testing) {
      runTest();
    }
  }, [wizard.step, wizard.testResult, testing, runTest]);

  // ── Welcome Step ──────────────────────────────────────────────────
  if (wizard.step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="mb-6">
          <Activity size={48} className="text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Welcome to GIA</h1>
        <p className="text-zinc-400 text-sm max-w-md mb-8">
          Your intelligent Android assistant. Let's get you connected to an AI provider so
          you can start chatting, coding, researching, and more.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => wizard.setStep('select-provider')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            Let's get started <ArrowRight size={16} />
          </button>
          <button
            onClick={handleClose}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ── Select Provider Step ─────────────────────────────────────────
  if (wizard.step === 'select-provider') {
    const allProviders = getAllProvidersWithCustom();

    const handleProviderSelect = (id: string) => {
      wizard.setProvider(id);
      wizard.setIsCustom(false);
      setCustomName('');
      setCustomBaseUrl('');
      setCustomApiKey('');
      setShowCustomForm(false);

      const def = providerRegistry.getProvider(id);
      if (def && !def.needsApiKey) {
        // Local provider — skip key entry, go to model select
        wizard.setApiKey('');
        setBusy(true);
        fetchModels(id)
          .then((models) => {
            setFetchedModels(models);
            wizard.setStep('select-model');
          })
          .catch(() => {
            setFetchedModels(providerRegistry.getModels(id));
            wizard.setStep('select-model');
          })
          .finally(() => setBusy(false));
      } else {
        wizard.setStep('enter-key');
      }
    };

    const handleAddCustomProvider = async () => {
      if (!customName.trim() || !customBaseUrl.trim()) return;

      const id = addCustomProvider({
        name: customName.trim(),
        baseUrl: customBaseUrl.trim(),
        apiKey: customApiKey,
        modelListEndpoint: '/v1/models',
        modelRegex: '',
        headers: {},
        capabilities: [],
      });

      wizard.setCustomProviderId(id);
      wizard.setProvider(id);
      wizard.setApiKey(customApiKey);
      wizard.setIsCustom(true);
      wizard.setStep('test-connection');
    };

    return (
      <div className="flex flex-col h-full px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => wizard.setStep('welcome')} className="text-zinc-400 hover:text-zinc-200">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-zinc-100">Select Provider</h2>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {allProviders.map((def) => (
            <button
              key={def.id}
              onClick={() => handleProviderSelect(def.id)}
              disabled={busy}
              className={clsx(
                'w-full text-left p-4 rounded-lg border transition-colors',
                'hover:border-indigo-500 hover:bg-zinc-800/50',
                wizard.provider === def.id
                  ? 'border-indigo-500 bg-zinc-800/60'
                  : 'border-zinc-700 bg-zinc-900'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-sm">
                    {def.label.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{def.label}</p>
                    <p className="text-xs text-zinc-500">{def.listingType}</p>
                  </div>
                </div>
                {def.needsApiKey ? (
                  <Wifi size={14} className="text-zinc-600" />
                ) : (
                  <WifiOff size={14} className="text-zinc-600" />
                )}
              </div>
            </button>
          ))}

          {/* Custom provider form */}
          <div className="border-t border-zinc-800 pt-3 mt-3">
            <button
              onClick={() => setShowCustomForm(!showCustomForm)}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors w-full py-2"
            >
              <Plus size={14} />
              Add Custom Provider
            </button>

            {showCustomForm && (
              <div className="mt-2 p-3 rounded-lg border border-zinc-700 bg-zinc-900 space-y-3">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Provider name (e.g., My AI)"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="Base URL (e.g., https://api.example.com/v1)"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="API Key (optional)"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleAddCustomProvider}
                  disabled={!customName.trim() || !customBaseUrl.trim()}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Add & Validate
                </button>
              </div>
            )}
          </div>
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 mt-3">
            <Loader2 size={14} className="animate-spin" />
            Loading models...
          </div>
        )}
      </div>
    );
  }

  // ── Enter API Key Step ───────────────────────────────────────────
  if (wizard.step === 'enter-key') {
    const handlePaste = async () => {
      try {
        const text = await navigator.clipboard.readText();
        wizard.setApiKey(text);
        setKeyError('');
      } catch {
        setKeyError('Unable to read clipboard');
      }
    };

    const handleContinue = () => {
      if (wizard.apiKey.trim().length < 8) {
        setKeyError('API key must be at least 8 characters');
        return;
      }
      setKeyError('');
      wizard.setStep('test-connection');
    };

    return (
      <div className="flex flex-col h-full px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => wizard.setStep('select-provider')} className="text-zinc-400 hover:text-zinc-200">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-zinc-100">API Key</h2>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full gap-4">
          <p className="text-sm text-zinc-400 text-center">
            Enter your API key for <span className="text-zinc-200 font-medium">{providerRegistry.getLabel(wizard.provider)}</span>
          </p>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={wizard.apiKey}
              onChange={(e) => {
                wizard.setApiKey(e.target.value);
                setKeyError('');
              }}
              placeholder="sk-..."
              className={clsx(
                'w-full bg-zinc-800 border rounded-lg px-4 py-3 pr-20 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors',
                keyError ? 'border-rose-500' : 'border-zinc-700 focus:border-indigo-500'
              )}
              autoFocus
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                onClick={handlePaste}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Paste from clipboard"
              >
                <Clipboard size={14} />
              </button>
            </div>
          </div>

          {keyError && <p className="text-xs text-rose-400">{keyError}</p>}

          <button
            onClick={handleContinue}
            disabled={wizard.apiKey.trim().length < 8}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
          >
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (wizard.step === 'test-connection') {
    return (
      <div className="flex flex-col h-full px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => wizard.setStep('enter-key')} className="text-zinc-400 hover:text-zinc-200">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-zinc-100">Test Connection</h2>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {testing && (
            <>
              <Loader2 size={32} className="text-indigo-400 animate-spin" />
              <p className="text-sm text-zinc-400">Testing connection...</p>
            </>
          )}

          {!testing && wizard.testResult && (
            <>
              {wizard.testResult.success ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                  </div>
                  <p className="text-lg font-semibold text-emerald-400">Connected!</p>
                  {wizard.testResult.latencyMs && (
                    <p className="text-sm text-zinc-500">{wizard.testResult.latencyMs}ms latency</p>
                  )}
                  {wizard.testResult.models && wizard.testResult.models.length > 0 && (
                    <p className="text-xs text-zinc-600">{wizard.testResult.models.length} models found</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center">
                    <X size={32} className="text-rose-400" />
                  </div>
                  <p className="text-lg font-semibold text-rose-400">Connection Failed</p>
                  <p className="text-sm text-zinc-500 max-w-xs text-center">
                    {wizard.testResult.error || 'Could not reach the provider'}
                  </p>
                </div>
              )}
            </>
          )}

          {!testing && (
            <div className="flex gap-3 mt-4">
              {wizard.testResult?.success ? (
                <button
                  onClick={() => {
                    wizard.setStep('select-model');
                    setBusy(true);
                    fetchModels(wizard.provider)
                      .then((models) => {
                        setFetchedModels(models);
                      })
                      .catch(() => {
                        setFetchedModels(providerRegistry.getModels(wizard.provider));
                      })
                      .finally(() => setBusy(false));
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                >
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  onClick={runTest}
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => wizard.setStep('enter-key')}
                className="px-6 py-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Select Model Step ────────────────────────────────────────────
  if (wizard.step === 'select-model') {
    const models = fetchedModels.length > 0 ? fetchedModels : providerRegistry.getModels(wizard.provider);

    const handleSelectModel = (modelId: string) => {
      wizard.setModel(modelId);
      setProviderModel(wizard.provider, modelId);
    };

    const handleDone = () => {
      // Save the provider key if needed
      if (wizard.apiKey) {
        setProviderKey(wizard.provider, wizard.apiKey);
      }
      if (wizard.model) {
        setProviderModel(wizard.provider, wizard.model);
      }
      setActiveProvider(wizard.provider);

      wizard.setStep('done');
    };

    return (
      <div className="flex flex-col h-full px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => wizard.setStep('test-connection')} className="text-zinc-400 hover:text-zinc-200">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-zinc-100">Select Model</h2>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {models.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">No models available</p>
          )}
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelectModel(m.id)}
              className={clsx(
                'w-full text-left p-4 rounded-lg border transition-colors',
                wizard.model === m.id
                  ? 'border-indigo-500 bg-zinc-800/60'
                  : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{m.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {m.context && `${m.context} context`}
                    {m.free ? ' · Free' : ' · Paid'}
                    {m.tools && ' · Tools'}
                    {m.vision && ' · Vision'}
                  </p>
                </div>
                <div
                  className={clsx(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                    wizard.model === m.id
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-zinc-600'
                  )}
                >
                  {wizard.model === m.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleDone}
          disabled={!wizard.model}
          className="mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
        >
          Continue <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  // ── Done Step ────────────────────────────────────────────────────
  if (wizard.step === 'done') {
    const def = providerRegistry.getProvider(wizard.provider) ||
      { label: wizard.provider, id: wizard.provider };

    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="mb-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">All Set!</h1>
        <p className="text-zinc-400 text-sm max-w-sm mb-8">
          GIA is ready to go. Here's your configuration summary:
        </p>

        <div className="w-full max-w-sm bg-zinc-900 rounded-lg border border-zinc-800 p-4 mb-8 space-y-3 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Provider</span>
            <span className="text-zinc-200 font-medium">{def.label}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Model</span>
            <span className="text-zinc-200 font-medium">{wizard.model || 'Default'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">API Key</span>
            <span className="text-zinc-200 font-medium">
              {wizard.apiKey ? `${wizard.apiKey.slice(0, 8)}...${wizard.apiKey.slice(-4)}` : 'None'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              setActiveProvider(wizard.provider);
              if (wizard.apiKey) {
                setProviderKey(wizard.provider, wizard.apiKey);
              }
              if (wizard.model) {
                setProviderModel(wizard.provider, wizard.model);
              }
              onComplete?.();
              handleClose();
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            Start using GIA <ArrowRight size={16} />
          </button>
          <button
            onClick={() => {
              setShowTerminal(true);
              handleClose();
            }}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Open Engine Room
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default SetupWizard;
