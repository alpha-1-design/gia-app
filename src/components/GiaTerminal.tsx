import React, { useState, useEffect } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { useProviderStore } from '../store/useProviderStore';

const GiaTerminal = () => {
  const {
    providers,
    setProviderKey,
    setActiveProvider,
    activeProvider
  } = useProviderStore();

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ type: 'cmd' | 'res' | 'err'; text: string }[]>([
    { type: 'res', text: 'GIA Provider Management Kernel v1.1.0' },
    { type: 'res', text: 'Type "help" to see configuration commands.' },
    { type: 'res', text: '------------------------------------------------' },
  ]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.toLowerCase().trim();
    const newHistory: { type: 'cmd' | 'res' | 'err'; text: string }[] = [...history, { type: 'cmd', text: `gia@user:~$ ${input}` }];

    if (cmd === 'help') {
      newHistory.push({
        type: 'res',
        text: 'Available commands:\n- connect-or [key]: Link OpenRouter API key\n- connect-oc [key]: Link OpenCode Zen API key\n- set-model [provider] [model]: Change LLM model\n- use [provider]: Switch active provider\n- status: Check connection state\n- clear: Reset terminal'
      });
    } else if (cmd.startsWith('connect-or ')) {
      const key = cmd.split(' ')[1];
      setProviderKey('openrouter', key);
      newHistory.push({ type: 'res', text: '✅ OpenRouter key linked. Provider enabled.' });
    } else if (cmd.startsWith('connect-oc ')) {
      const key = cmd.split(' ')[1];
      setProviderKey('opencode', key);
      newHistory.push({ type: 'res', text: '✅ OpenCode Zen key linked. Provider enabled.' });
    } else if (cmd.startsWith('use ')) {
      const provider = cmd.split(' ')[1] as 'openrouter' | 'opencode';
      if (provider === 'openrouter' || provider === 'opencode') {
        setActiveProvider(provider);
        newHistory.push({ type: 'res', text: `Active provider switched to ${provider}.` });
      } else {
        newHistory.push({ type: 'err', text: 'Invalid provider. Use "openrouter" or "opencode".' });
      }
    } else if (cmd === 'status') {
      const orStatus = providers.openrouter.enabled ? 'ONLINE' : 'OFFLINE';
      const ocStatus = providers.opencode.enabled ? 'ONLINE' : 'OFFLINE';
      newHistory.push({
        type: 'res',
        text: `OpenRouter: ${orStatus} (${providers.openrouter.model})\nOpenCode Zen: ${ocStatus} (${providers.opencode.model})\nActive: ${activeProvider.toUpperCase()}`
      });
    } else if (cmd === 'clear') {
      setHistory([]);
      setInput('');
      return;
    } else {
      newHistory.push({ type: 'err', text: `Unknown command: ${cmd}. Type "help" for options.` });
    }

    setHistory(newHistory);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl font-mono text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-zinc-400" />
          <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Provider Management</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">ACTIVE:</span>
          <span className={`text-[10px] font-bold uppercase ${activeProvider === 'openrouter' ? 'text-indigo-400' : 'text-emerald-400'}`}>
            {activeProvider}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-zinc-700"
      >
        {history.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap ${
            line.type === 'cmd' ? 'text-emerald-400' :
            line.type === 'err' ? 'text-rose-400' : 'text-zinc-300'
          }`}>
            {line.text}
          </div>
        ))}
      </div>

      <form onSubmit={handleCommand} className="p-4 bg-zinc-900 border-t border-zinc-800 flex gap-2">
        <span className="text-emerald-400 shrink-0">gia@user:~$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="bg-transparent border-none outline-none text-zinc-100 flex-1"
          autoFocus
          spellCheck={false}
        />
      </form>
    </div>
  );
};

export default GiaTerminal;
