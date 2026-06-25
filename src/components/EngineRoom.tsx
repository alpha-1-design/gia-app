import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Terminal as TerminalIcon, Wifi, WifiOff } from 'lucide-react';
import { useProviderStore, ModelOption } from '../store/useProviderStore';
import { providerRegistry } from '../services/ProviderRegistry';
import { useGiaStore } from '../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';
import { getProviderCapabilities, CAPABILITY_LABELS, type ProviderCapabilities } from '../services/providers/capabilities';
import { providerMonitor } from '../services/ProviderMonitor';
import { persistenceManager } from '../services/PersistenceManager';

type LineType = 'cmd' | 'res' | 'err' | 'info' | 'prompt' | 'success';
interface Line { type: LineType; text: string; id: number }
type WizardStep =
  | null
  | { flow: 'select-provider' }
  | { flow: 'enter-key'; provider: string }
  | { flow: 'select-model'; provider: string; models: ModelOption[] };

let lid = 0;
const mk = (type: LineType, text: string): Line => ({ type, text, id: lid++ });

let lastExport: string | null = null;

const BOOT: Line[] = [
  mk('info', '╔══════════════════════════════════════════╗'),
  mk('info', '║        GIA ENGINE ROOM  v2.3.1.2         ║'),
  mk('info', '║  10 Providers · Dynamic Model Fetch      ║'),
  mk('info', '╚══════════════════════════════════════════╝'),
  mk('res', ''),
  mk('res', 'Supported: OpenRouter · Anthropic · OpenAI · Gemini'),
  mk('res', '          Groq · OpenCode · DeepSeek · Cerebras · Mistral · HuggingFace'),
  mk('res', ''),
  mk('res', 'Type  help  for commands.'),
  mk('res', ''),
];

const EngineRoom: React.FC = () => {
  const { setShowTerminal } = useGiaStore();
  const { providers, activeProvider, setProviderKey, setProviderModel, setActiveProvider, setProviderBaseUrl, disconnectProvider, fetchModels } = useProviderStore(useShallow(s => ({
    providers: s.providers, activeProvider: s.activeProvider,
    setProviderKey: s.setProviderKey, setProviderModel: s.setProviderModel,
    setActiveProvider: s.setActiveProvider, setProviderBaseUrl: s.setProviderBaseUrl,
    disconnectProvider: s.disconnectProvider, fetchModels: s.fetchModels,
  })));
  const [history, setHistory] = useState<Line[]>(BOOT);
  const [input, setInput] = useState('');
  const [cmdHist, setCmdHist] = useState<string[]>([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
   const [, _setWizard] = useState<WizardStep>(null);
   const wizardRef = useRef<WizardStep>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setImportBuffer] = useState('');
  const importingRef = useRef(false);
  const importBufferRef = useRef('');

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

  const showModels = (models: ModelOption[], provider?: string) =>
    models.map((m, i) => {
      const caps = provider ? getProviderCapabilities(providerRegistry.getListingType(provider), m.id, m.vision, m.tools) : null;
      const capStr = caps
        ? `${caps.vision ? '👁' : '  '}${caps.tools ? '🛠' : '  '}${caps.thinking ? '🧠' : '  '}${caps.jsonMode ? '📋' : '  '}`
        : `${m.vision ? '👁' : '  '}${m.tools === false ? '   ' : ' 🛠'}    `;
      return mk('res', `  ${String(i + 1).padStart(2)}. ${m.label.slice(0, 32).padEnd(32)} ${m.context?.padEnd(5) ?? '?    '} ${m.free ? 'FREE' : 'PAID'} ${capStr}`);
    });

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
        const allProviders = providerRegistry.getAllProviders();
        if (!isNaN(idx) && allProviders[idx]) {
          const p = allProviders[idx].id;
          setWizard({ flow: 'enter-key', provider: p });
          push(mk('res', `Provider: ${providerRegistry.getLabel(p)}`), mk('prompt', 'Paste your API key (or type "cancel"):'));
        } else push(mk('err', `Enter 1–${allProviders.length}.`));
        return;
      }

      if (currentWizard.flow === 'enter-key') {
        // Handle retry when previous model fetch failed
        if (cmd === 'retry') {
          push(mk('success', 'Retrying model fetch...'));
          setBusy(true);
          try {
            const models = await fetchModels(currentWizard.provider);
            if (models.length === 0) {
              push(mk('err', 'No models found. Using defaults.'));
              const defaults = providerRegistry.getModels(currentWizard.provider);
              setWizard({ flow: 'select-model', provider: currentWizard.provider, models: defaults });
              push(...showModels(defaults, currentWizard.provider), mk('prompt', 'Enter model number:'));
            } else {
              setWizard({ flow: 'select-model', provider: currentWizard.provider, models });
              push(...showModels(models, currentWizard.provider), mk('prompt', 'Enter model number:'));
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            push(mk('err', `Fetch failed: ${msg}`));
            push(mk('info', 'Type "retry" to try again, or "cancel" to go back.'));
          } finally {
            setBusy(false);
          }
          return;
        }

        if (trimmed.length < 8) { push(mk('err', 'Key too short.')); return; }
        setProviderKey(currentWizard.provider, trimmed);
        push(mk('success', '✓ Key saved. Fetching models...'));
        setBusy(true);
        try {
          const models = await fetchModels(currentWizard.provider);
          if (models.length === 0) {
            push(mk('err', 'No models found. Using defaults.'));
            const defaults = providerRegistry.getModels(currentWizard.provider);
            setWizard({ flow: 'select-model', provider: currentWizard.provider, models: defaults });
            push(...showModels(defaults, currentWizard.provider), mk('prompt', 'Enter model number:'));
          } else {
            setWizard({ flow: 'select-model', provider: currentWizard.provider, models });
            push(...showModels(models, currentWizard.provider), mk('prompt', 'Enter model number:'));
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          push(mk('err', `Fetch failed: ${msg}`));
          push(mk('info', 'Type "retry" to try again, or "cancel" to go back.'));
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
            mk('success', `✓ Active: ${providerRegistry.getLabel(provider)}`),
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
        mk('res', '  capabilities / caps  Show active provider capabilities'),
        mk('res', '  use <alias>          Switch active provider'),
        mk('res', '  status               Show all provider states + health'),
        mk('res', '  health               Ping all providers, show latency'),
        mk('res', '  disconnect <alias>   Remove provider key'),
        mk('res', '  url <alias> <url>    Set custom base URL (for local providers)'),
        mk('res', '  net status           Show network state'),
        mk('res', '  net ping             Test connectivity & latency'),
        mk('res', '  export               Export all data as JSON'),
        mk('res', '  import               Import data from JSON string'),
        mk('res', '  clear                Clear terminal'),
        mk('res', '  exit / back          Close Engine Room'),
        mk('res', ''),
      );
      return;
    }

    if (cmd === 'connect') {
      const allProviders = providerRegistry.getAllProviders();
      setWizard({ flow: 'select-provider' });
      push(mk('res', ''), mk('prompt', 'Select provider:'));
      allProviders.forEach((def, i) => push(mk('res', `  ${i + 1}. ${def.label}`)));
      push(mk('res', ''), mk('prompt', 'Enter number:'));
      return;
    }

    const connectMatch = trimmed.match(/^connect\s+(\S+)\s+(\S+)$/i);
    if (connectMatch) {
      const alias = connectMatch[1].toLowerCase();
      const key = connectMatch[2];
      const p = providerRegistry.resolveAlias(alias);
      if (!p) { push(mk('err', `Unknown alias "${alias}".`)); return; }
      setProviderKey(p, key);
      push(mk('success', `✓ Key saved for ${providerRegistry.getLabel(p)}.`));
      setBusy(true);
      try {
        const models = await fetchModels(p);
        const list = models.length > 0 ? models : providerRegistry.getModels(p);
        setWizard({ flow: 'select-model', provider: p, models: list });
        push(...showModels(list, p), mk('prompt', 'Enter model number:'));
      } catch (e) {
        push(mk('err', `Fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`));
      } finally {
        setBusy(false);
      }
      return;
    }

    const modelMatch = trimmed.match(/^model\s+(\S+)$/i);
    if (modelMatch) {
      const p = providerRegistry.resolveAlias(modelMatch[1].toLowerCase());
      if (!p) { push(mk('err', `Unknown alias.`)); return; }
      if (!providers[p]?.enabled) { push(mk('err', `${providerRegistry.getLabel(p)} not connected.`)); return; }
      push(mk('prompt', `Fetching models for ${providerRegistry.getLabel(p)}...`));
      setBusy(true);
      try {
        const models = await fetchModels(p);
        const list = models.length > 0 ? models : providerRegistry.getModels(p);
        setWizard({ flow: 'select-model', provider: p, models: list });
        push(...showModels(list, p), mk('prompt', 'Enter number:'));
      } catch {
        push(mk('err', `Fetch failed.`));
      } finally {
        setBusy(false);
      }
      return;
    }

    const useMatch = trimmed.match(/^use\s+(\S+)$/i);
    if (useMatch) {
      const p = providerRegistry.resolveAlias(useMatch[1].toLowerCase());
      if (!p) { push(mk('err', `Unknown alias.`)); return; }
      if (!providers[p]?.enabled) { push(mk('err', `${providerRegistry.getLabel(p)} not connected.`)); return; }
      setActiveProvider(p);
      push(mk('success', `✓ Active → ${providerRegistry.getLabel(p)}`));
      return;
    }

    const discMatch = trimmed.match(/^disconnect\s+(\S+)$/i);
    if (discMatch) {
      const p = providerRegistry.resolveAlias(discMatch[1].toLowerCase());
      if (!p) { push(mk('err', `Unknown alias.`)); return; }
      disconnectProvider(p);
      push(mk('res', `✓ ${providerRegistry.getLabel(p)} disconnected.`));
      if (activeProvider === p) {
        const currentProviders = useProviderStore.getState().providers;
        const other = providerRegistry.getAllIds().find(x => x !== p && currentProviders[x]?.enabled);
        if (other) setActiveProvider(other);
      }
      return;
    }

    if (cmd === 'status') {
      push(mk('res', ''), mk('info', 'PROVIDER STATUS'));
      providerRegistry.getAllProviders().forEach((def) => {
        const p = def.id;
        const cfg = providers[p];
        const active = p === activeProvider ? ' ← ACTIVE' : '';
        const model = cfg?.model || 'off';
        const status = cfg?.enabled ? '●' : '○';
        const health = providerMonitor.getHealth(p, cfg?.model ?? "");
        const latency = health.latencyMs !== null ? ` ${health.latencyMs}ms` : '';
        const errs = health.failedCalls > 0 ? ` ⚠${health.failedCalls}` : '';
        push(mk(cfg?.enabled ? 'success' : 'err', `  ${status} ${def.label.padEnd(12)} ${model}${latency}${errs}${active}`));
        if (cfg?.enabled && model !== 'off') {
          const caps = getProviderCapabilities(def.listingType, model);
          const capStr = (Object.keys(CAPABILITY_LABELS) as (keyof ProviderCapabilities)[])
            .filter(k => caps[k])
            .map(k => CAPABILITY_LABELS[k].icon)
            .join(' ');
          push(mk('res', `     ${capStr}`));
        }
      });
      push(mk('res', ''));
      const net = providerMonitor.getNetwork();
      push(mk('info', `NETWORK: ${net.online ? '● Online' : '○ Offline'}  ${net.type}  ${net.latencyMs ? `${net.latencyMs}ms` : ''}`));
      return;
    }

    if (cmd === 'health') {
      push(mk('res', ''), mk('info', 'HEALTH CHECK — pinging all enabled providers...'));
      setBusy(true);
      providerMonitor.testAllProviders().then((results) => {
        results.forEach(r => {
          const icon = r.online ? '●' : '○';
          const lat = r.latencyMs !== null ? `${r.latencyMs}ms` : '—';
          const err = r.online ? '' : `  ${r.lastError || 'unreachable'}`;
          push(mk(r.online ? 'success' : 'err',
            `  ${icon} ${r.providerId.padEnd(12)} ${lat.padEnd(7)} calls:${r.totalCalls} errs:${r.failedCalls}${err}`));
        });
        push(mk('res', ''));
        const net = providerMonitor.getNetwork();
        push(mk('info', `NETWORK: ${net.online ? '● Online' : '○ Offline'}  ${net.type}  latency: ${net.latencyMs ? `${net.latencyMs}ms` : '?'}`));
      }).catch(() => {
        push(mk('err', 'Health check failed.'));
      }).finally(() => setBusy(false));
      return;
    }

    if (cmd === 'capabilities' || cmd === 'caps' || cmd === 'info') {
      const p = activeProvider;
      const cfg = providers[p];
      if (!cfg?.enabled) { push(mk('err', 'No active provider.')); return; }
      const caps = getProviderCapabilities(providerRegistry.getListingType(p), cfg.model);
      const def = providerRegistry.getProvider(p);
      push(mk('res', ''), mk('info', `CAPABILITIES: ${def?.label || p}`));
      push(mk('res', `  Model:     ${cfg.model}`));
      push(mk('res', `  Type:      ${def?.listingType || 'unknown'}`));
      push(mk('res', ''));
      (Object.keys(CAPABILITY_LABELS) as (keyof ProviderCapabilities)[])
        .forEach(k => {
          const meta = CAPABILITY_LABELS[k];
          push(mk(caps[k] ? 'success' : 'err', `  ${meta.icon} ${meta.label.padEnd(18)} ${caps[k] ? '✓ Supported' : '— Unsupported'}`));
        });
      push(mk('res', ''));
      return;
    }

    const urlMatch = trimmed.match(/^url\s+(\S+)\s+(\S+)$/i);
    if (urlMatch) {
      const alias = urlMatch[1].toLowerCase();
      const url = urlMatch[2];
      const p = providerRegistry.resolveAlias(alias);
      if (!p) { push(mk('err', `Unknown alias "${alias}".`)); return; }
      if (!['ollama', 'lmstudio'].includes(p)) { push(mk('err', `Custom URLs only for local providers (ollama, lmstudio).`)); return; }
      setProviderBaseUrl(p, url);
      push(mk('success', `✓ Custom URL set for ${providerRegistry.getLabel(p)}: ${url}`));
      return;
    }

    if (cmd === 'clear') {
      const freshBoot = BOOT.slice(0, 4).map(l => ({ ...l, id: lid++ }));
      setHistory(freshBoot);
      return;
    }

    // ── EXPORT ────────────────────────────────────────────────────────
    if (cmd === 'export') {
      push(mk('info', 'Exporting all data...'));
      setBusy(true);
      persistenceManager.exportAll()
        .then((json) => {
          push(mk('success', `✓ Exported ${json.length.toLocaleString()} bytes`));
          push(mk('res', ''));
          // Show first/last few chars so user can verify
          const preview = json.length > 200 ? json.slice(0, 100) + '\n...\n' + json.slice(-100) : json;
          push(mk('res', preview));
          push(mk('res', ''));
          push(mk('info', 'Copy the JSON above to save, or use the button below:'));
          push(mk('info', '  Type  copy-export  to copy to clipboard'));
          // Store export json in a ref-like way — we push a hidden marker
          push(mk('prompt', 'TIP: "copy-export" copies export data to clipboard'));
          // Store the export data in a module-level variable
          lastExport = json;
        })
        .catch((e) => push(mk('err', `Export failed: ${e instanceof Error ? e.message : 'Unknown'}`)))
        .finally(() => setBusy(false));
      return;
    }

    // ── IMPORT ────────────────────────────────────────────────────────
    if (cmd === 'import') {
      push(mk('info', 'Paste your JSON export data (multi-line), then type "END" on a new line:'));
      push(mk('res', ''));
      setImportBuffer('');
      importBufferRef.current = '';
      importingRef.current = true;
      return;
    }

    // Handle multi-line import buffer
    if (importingRef.current) {
      if (trimmed === 'END') {
        importingRef.current = false;
        const json = importBufferRef.current;
        if (!json || json.trim().length < 10) {
          push(mk('err', 'No data provided. Import cancelled.'));
          setImportBuffer('');
          importBufferRef.current = '';
          return;
        }
        push(mk('info', 'Importing data...'));
        setBusy(true);
        persistenceManager.importAll(json)
          .then((result) => {
            if (result.success) {
              push(mk('success', '✓ Import successful!'));
              push(mk('info', 'Reload the app to apply changes.'));
            } else {
              push(mk('err', `Import completed with ${result.errors.length} error(s):`));
              result.errors.slice(0, 5).forEach((err) => push(mk('err', `  • ${err}`)));
              if (result.errors.length > 5) {
                push(mk('err', `  … and ${result.errors.length - 5} more`));
              }
            }
          })
          .catch((e) => push(mk('err', `Import failed: ${e instanceof Error ? e.message : 'Unknown'}`)))
          .finally(() => { setBusy(false); setImportBuffer(''); importBufferRef.current = ''; });
      } else {
        const newVal = importBufferRef.current
          ? importBufferRef.current + '\n' + trimmed
          : trimmed;
        importBufferRef.current = newVal;
        setImportBuffer(newVal);
        push(mk('info', `  [${newVal.length} chars buffered]`));
      }
      return;
    }

    // ── COPY EXPORT ───────────────────────────────────────────────────
    if (cmd === 'copy-export') {
      if (lastExport) {
        navigator.clipboard.writeText(lastExport).then(
          () => push(mk('success', '✓ Export data copied to clipboard')),
          () => push(mk('err', 'Failed to copy to clipboard'))
        );
      } else {
        push(mk('err', 'No export data available. Run "export" first.'));
      }
      return;
    }

    // ── NET COMMANDS ────────────────────────────────────────────────
    if (cmd.startsWith('net ')) {
      const netCmd = cmd.slice(4).trim();
      if (netCmd === 'status' || netCmd === '') {
        const net = providerMonitor.getNetwork();
        push(mk('res', ''), mk('info', 'NETWORK STATUS'));
        push(mk('res', `  Status:  ${net.online ? '● Online' : '○ Offline'}`));
        push(mk('res', `  Type:    ${net.type || 'Unknown'}`));
        push(mk('res', `  Metered: ${net.metered ? 'Yes' : 'No'}`));
        push(mk('res', `  Latency: ${net.latencyMs !== null ? `${net.latencyMs}ms` : '?'}`));
        push(mk('res', ''));
      } else if (netCmd === 'ping') {
        push(mk('res', ''), mk('info', 'PINGING...'));
        setBusy(true);
        providerMonitor.pingNetwork()
          .then(ms => push(mk('success', `  ✓ ${ms}ms`)))
          .catch(() => push(mk('err', '  ✗ Network unreachable')))
          .finally(() => { push(mk('res', '')); setBusy(false); });
      } else {
        push(mk('err', `Unknown net command: ${netCmd}. Use 'net status' or 'net ping'.`));
      }
      return;
    }

    push(mk('err', `Unknown: "${trimmed}".`));
  }, [push, providers, activeProvider, setProviderKey, setProviderModel, setActiveProvider, setProviderBaseUrl, disconnectProvider, fetchModels, setShowTerminal]);

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

  const allProviderIds = providerRegistry.getAllIds();
  const connectedCount = allProviderIds.filter(p => providers[p]?.enabled).length;

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
          <span className="text-[10px] text-zinc-500">{connectedCount}/{allProviderIds.length} connected</span>
          {allProviderIds.map(p => (
            <div key={p} title={providerRegistry.getLabel(p)} className="flex items-center">
              {providers[p]?.enabled
                ? <Wifi size={11} className={p === activeProvider ? 'text-amber-400' : 'text-emerald-400'} />
                : <WifiOff size={11} className="text-zinc-700" />}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] text-indigo-400 uppercase tracking-wider">{providerRegistry.getLabel(activeProvider)}</span>
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
          className="flex-1 bg-transparent border-none outline-none text-zinc-100 caret-emerald-400 min-w-0"
          autoComplete="off" spellCheck={false} autoCapitalize="off"
          inputMode="text" enterKeyHint="send"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} 
          className="text-emerald-500 hover:text-emerald-400 disabled:text-zinc-700 transition-colors">
          <ArrowLeft size={18} className="rotate-180" />
        </button>
      </form>
    </div>
  );
};

export default EngineRoom;
