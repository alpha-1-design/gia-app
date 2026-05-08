import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Terminal as TerminalIcon, Wifi, WifiOff } from 'lucide-react';
import { useProviderStore, ProviderType, PROVIDER_DEFAULTS, STATIC_MODELS, ModelOption } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';

type LineType = 'cmd' | 'res' | 'err' | 'info' | 'prompt' | 'success';
interface Line { type: LineType; text: string; id: number }
type WizardStep =
  | null
  | { flow: 'select-provider' }
  | { flow: 'enter-key'; provider: ProviderType }
  | { flow: 'select-model'; provider: ProviderType; models: ModelOption[] };

let lid = 0;
const mk = (type: LineType, text: string): Line => ({ type, text, id: lid++ });

const ALL_PROVIDERS: ProviderType[] = ['openrouter', 'anthropic', 'openai', 'gemini', 'groq', 'opencode'];
const PROVIDER_ALIAS: Record<string, ProviderType> = {
  or: 'openrouter', openrouter: 'openrouter',
  ant: 'anthropic', anthropic: 'anthropic',
  oai: 'openai', openai: 'openai',
  gem: 'gemini', gemini: 'gemini',
  groq: 'groq',
  oc: 'opencode', opencode: 'opencode',
};

const BOOT: Line[] = [
  mk('info', '╔══════════════════════════════════════════╗'),
  mk('info', '║        GIA ENGINE ROOM  v2.2.0           ║'),
  mk('info', '║   6 Providers · Dynamic Model Fetch      ║'),
  mk('info', '╚══════════════════════════════════════════╝'),
  mk('res', ''),
  mk('res', 'Supported: OpenRouter · Anthropic · OpenAI'),
  mk('res', '          Gemini · Groq · OpenCode'),
  mk('res', ''),
  mk('res', 'Type  help  for commands.'),
  mk('res', ''),
];

const EngineRoom: React.FC = () => {
  const { setShowTerminal } = useGiaStore();
  const { providers, activeProvider, setProviderKey, setProviderModel, setActiveProvider, disconnectProvider, fetchModels } = useProviderStore();
  const [history, setHistory] = useState<Line[]>(BOOT);
  const [input, setInput] = useState('');
  const [cmdHist, setCmdHist] = useState<string[]>([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
  const [wizard, _setWizard] = useState<WizardStep>(null);
  const wizardRef = useRef<WizardStep>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setWizard = (w: WizardStep) => {
    wizardRef.current = w;
    _setWizard(w);
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [history]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const push = useCallback((...lines: Line[]) => setHistory(h => [...h, ...lines]), []);

  const getPrompt = (currentWizard: WizardStep) => {
    if (!currentWizard) return 'gia@engine:~$ ';
    if (currentWizard.flow === 'select-provider') return '[select #] > ';
    if (currentWizard.flow === 'enter-key') return `[${currentWizard.provider}] paste key > `;
    if (currentWizard.flow === 'select-model') return '[select #] > ';
    return 'gia@engine:~$ ';
  };

  const lc = (t: LineType) => ({ cmd: 'text-emerald-400', err: 'text-rose-400', info: 'text-indigo-300', prompt: 'text-amber-300', success: 'text-emerald-300', res: 'text-zinc-300' }[t]);

  const showModels = (models: ModelOption[]) =>
    models.map((m, i) => mk('res', `  ${String(i + 1).padStart(2)}. ${m.label.slice(0, 36).padEnd(36)} ${m.context ?? '?  '} ${m.free ? '[ FREE ]' : '[ PAID ]'}`));

  const handleCommand = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    
    const currentWizard = wizardRef.current;
    push(mk('cmd', `${getPrompt(currentWizard)}${trimmed}`));
    setCmdHist(h => [trimmed, ...h.slice(0, 49)]);
    setCmdIdx(-1);

    const cmd = trimmed.toLowerCase();

    // ── GLOBAL CANCEL ─────────────────────────────────────────────
    if (cmd === 'cancel' || cmd === 'back' || cmd === 'exit') {
      if (currentWizard) {
        setWizard(null);
        push(mk('info', 'Wizard cancelled.'));
      } else {
        setShowTerminal(false);
      }
      return;
    }

    // ── WIZARD FLOWS ──────────────────────────────────────────────
    if (currentWizard) {
      if (currentWizard.flow === 'select-provider') {
        const idx = parseInt(trimmed) - 1;
        if (!isNaN(idx) && ALL_PROVIDERS[idx]) {
          const p = ALL_PROVIDERS[idx];
          setWizard({ flow: 'enter-key', provider: p });
          push(mk('res', `Provider: ${PROVIDER_DEFAULTS[p].label}`), mk('prompt', 'Paste your API key (or type "cancel"):'));
        } else push(mk('err', `Enter 1–${ALL_PROVIDERS.length}.`));
        return;
      }

      if (currentWizard.flow === 'enter-key') {
        if (trimmed.length < 8) { push(mk('err', 'Key too short.')); return; }
        setProviderKey(currentWizard.provider, trimmed);
        push(mk('success', '✓ Key saved. Fetching models...'));
        setBusy(true);
        try {
          const models = await fetchModels(currentWizard.provider);
          if (models.length === 0) {
            push(mk('err', 'No models found. Using defaults.'));
            const defaults = STATIC_MODELS[currentWizard.provider];
            setWizard({ flow: 'select-model', provider: currentWizard.provider, models: defaults });
            push(...showModels(defaults), mk('prompt', 'Enter model number:'));
          } else {
            setWizard({ flow: 'select-model', provider: currentWizard.provider, models });
            push(...showModels(models), mk('prompt', 'Enter model number:'));
          }
        } catch (e) {
          push(mk('err', `Fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`));
          setWizard(null);
        } finally {
          setBusy(false);
        }
        return;
      }

      if (currentWizard.flow === 'select-model') {
        const idx = parseInt(trimmed) - 1;
        const { models, provider } = currentWizard;
        if (!isNaN(idx) && models[idx]) {
          setProviderModel(provider, models[idx].id);
          setActiveProvider(provider);
          setWizard(null);
          push(
            mk('success', `✓ Model: ${models[idx].label}`),
            mk('success', `✓ Active: ${PROVIDER_DEFAULTS[provider].label}`),
            mk('res', ''),
            mk('res', 'GIA is ready. Go back to Chat.'),
          );
        } else push(mk('err', `Enter 1–${models.length}.`));
        return;
      }
    }

    // ── TOP-LEVEL COMMANDS ────────────────────────────────────────
    if (cmd === 'help') {
      push(
        mk('res', ''), mk('info', 'COMMANDS'), mk('res', '─────────────────────────────────────────'),
        mk('res', '  connect              Guided setup wizard'),
        mk('res', '  connect <alias> <key> Quick connect'),
        mk('res', '  model <alias>        Change model for provider'),
        mk('res', '  use <alias>          Switch active provider'),
        mk('res', '  status               Show all provider states'),
        mk('res', '  disconnect <alias>   Remove provider key'),
        mk('res', '  clear                Clear terminal'),
        mk('res', '  exit / back          Close Engine Room'),
        mk('res', ''),
      );
      return;
    }

    if (cmd === 'connect') {
      setWizard({ flow: 'select-provider' });
      push(mk('res', ''), mk('prompt', 'Select provider:'));
      ALL_PROVIDERS.forEach((p, i) => push(mk('res', `  ${i + 1}. ${PROVIDER_DEFAULTS[p].label}`)));
      push(mk('res', ''), mk('prompt', 'Enter number:'));
      return;
    }

    const connectMatch = trimmed.match(/^connect\s+(\S+)\s+(\S+)$/i);
    if (connectMatch) {
      const alias = connectMatch[1].toLowerCase();
      const key = connectMatch[2];
      const p = PROVIDER_ALIAS[alias];
      if (!p) { push(mk('err', `Unknown alias "${alias}".`)); return; }
      setProviderKey(p, key);
      push(mk('success', `✓ Key saved for ${PROVIDER_DEFAULTS[p].label}.`));
      setBusy(true);
      try {
        const models = await fetchModels(p);
        const list = models.length > 0 ? models : STATIC_MODELS[p];
        setWizard({ flow: 'select-model', provider: p, models: list });
        push(...showModels(list), mk('prompt', 'Enter model number:'));
      } catch (e) {
        push(mk('err', `Fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`));
      } finally {
        setBusy(false);
      }
      return;
    }

    const modelMatch = trimmed.match(/^model\s+(\S+)$/i);
    if (modelMatch) {
      const p = PROVIDER_ALIAS[modelMatch[1].toLowerCase()];
      if (!p) { push(mk('err', `Unknown alias.`)); return; }
      if (!providers[p].enabled) { push(mk('err', `${PROVIDER_DEFAULTS[p].label} not connected.`)); return; }
      push(mk('prompt', `Fetching models for ${PROVIDER_DEFAULTS[p].label}...`));
      setBusy(true);
      try {
        const models = await fetchModels(p);
        const list = models.length > 0 ? models : STATIC_MODELS[p];
        setWizard({ flow: 'select-model', provider: p, models: list });
        push(...showModels(list), mk('prompt', 'Enter number:'));
      } catch (e) {
        push(mk('err', `Fetch failed.`));
      } finally {
        setBusy(false);
      }
      return;
    }

    const useMatch = trimmed.match(/^use\s+(\S+)$/i);
    if (useMatch) {
      const p = PROVIDER_ALIAS[useMatch[1].toLowerCase()];
      if (!p) { push(mk('err', `Unknown alias.`)); return; }
      if (!providers[p].enabled) { push(mk('err', `${PROVIDER_DEFAULTS[p].label} not connected.`)); return; }
      setActiveProvider(p);
      push(mk('success', `✓ Active → ${PROVIDER_DEFAULTS[p].label}`));
      return;
    }

    const discMatch = trimmed.match(/^disconnect\s+(\S+)$/i);
    if (discMatch) {
      const p = PROVIDER_ALIAS[discMatch[1].toLowerCase()];
      if (!p) { push(mk('err', `Unknown alias.`)); return; }
      disconnectProvider(p);
      push(mk('res', `✓ ${PROVIDER_DEFAULTS[p].label} disconnected.`));
      if (activeProvider === p) {
        // Find another enabled provider to set as active
        const other = ALL_PROVIDERS.find(x => x !== p && providers[x].enabled);
        if (other) setActiveProvider(other);
      }
      return;
    }

    if (cmd === 'status') {
      push(mk('res', ''), mk('info', 'PROVIDER STATUS'));
      ALL_PROVIDERS.forEach((p) => {
        const cfg = providers[p];
        const active = p === activeProvider ? ' ← ACTIVE' : '';
        push(mk(cfg.enabled ? 'success' : 'err', `  ${cfg.enabled ? '●' : '○'} ${PROVIDER_DEFAULTS[p].label.padEnd(12)} ${cfg.enabled ? cfg.model : 'off'}${active}`));
      });
      return;
    }

    if (cmd === 'clear') { 
      setHistory([BOOT[0], BOOT[1], BOOT[2], BOOT[3]]);
      return; 
    }

    push(mk('err', `Unknown: "${trimmed}".`));
  }, [push, providers, activeProvider, setProviderKey, setProviderModel, setActiveProvider, disconnectProvider, fetchModels, setShowTerminal]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    handleCommand(input);
    setInput('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); const i = Math.min(cmdIdx + 1, cmdHist.length - 1); setCmdIdx(i); setInput(cmdHist[i] ?? ''); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const i = Math.max(cmdIdx - 1, -1); setCmdIdx(i); setInput(i === -1 ? '' : cmdHist[i] ?? ''); }
  };

  const connectedCount = ALL_PROVIDERS.filter(p => providers[p].enabled).length;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTerminal(false)} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors">
            <ArrowLeft size={16} /><span className="text-xs">Back</span>
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          <TerminalIcon size={14} className="text-zinc-400" />
          <span className="text-xs font-medium text-zinc-400 tracking-widest uppercase">Engine Room</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">{connectedCount}/{ALL_PROVIDERS.length} connected</span>
          {ALL_PROVIDERS.map(p => (
            <div key={p} title={PROVIDER_DEFAULTS[p].label} className="flex items-center">
              {providers[p].enabled
                ? <Wifi size={11} className={p === activeProvider ? 'text-amber-400' : 'text-emerald-400'} />
                : <WifiOff size={11} className="text-zinc-700" />}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] text-indigo-400 uppercase tracking-wider">{PROVIDER_DEFAULTS[activeProvider]?.label ?? activeProvider}</span>
          </div>
        </div>
      </div>

      {/* Terminal output */}
      <div ref={scrollRef} onClick={() => inputRef.current?.focus()} className="flex-1 overflow-y-auto p-5 space-y-1 cursor-text">
        {history.map(line => (
          <div key={line.id} className={`whitespace-pre-wrap leading-relaxed ${lc(line.type)}`}>{line.text}</div>
        ))}
        {busy && <div className="text-amber-400 animate-pulse">  fetching models...</div>}
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="flex items-center gap-3 px-5 py-4 bg-zinc-900 border-t border-zinc-800 shrink-0">
        <span className="text-emerald-400 shrink-0 select-none">{getPrompt(wizardRef.current)}</span>
        <input
          ref={inputRef} type="text" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-zinc-100 caret-emerald-400"
          autoComplete="off" spellCheck={false} autoCapitalize="off"
          disabled={busy}
        />
      </form>
    </div>
  );
};

export default EngineRoom;
