import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Terminal, ArrowUpRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SubPageHeader } from './SubPageHeader';
import SandboxSetupPanel from '../SandboxSetupPanel';
import termuxService from '../../services/TermuxService';
import type { TermuxStatus } from '../../services/GIAIntent';

/**
 * Termux bridge status. Deliberately monochrome: the state is one word, the
 * action is one text button. The sandbox panel below does the heavy visual work.
 */
const TermuxCard: React.FC = () => {
  const [status, setStatus] = useState<TermuxStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try { setStatus(await termuxService.status()); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => { if (Capacitor.isNativePlatform()) void check(); }, [check]);

  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="gia-card p-3.5 flex items-start gap-2.5">
        <Terminal size={15} style={{ color: 'var(--gia-muted)' }} />
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Termux</p>
          <p className="text-[10.5px] leading-relaxed mt-0.5" style={{ color: 'var(--gia-muted)' }}>
            Commands run in the Android app. Use the sandbox below on the web.
          </p>
        </div>
      </div>
    );
  }

  const label = checking
    ? 'Checking…'
    : status?.ready
      ? 'Ready'
      : status?.installed
        ? 'Needs setup'
        : status
          ? 'Not installed'
          : '—';

  return (
    <div className="gia-card p-3.5 flex items-start gap-2.5">
      <Terminal size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--gia-muted)' }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Termux</span>
          <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{label}</span>
        </div>

        <p className="text-[10.5px] leading-relaxed mt-1" style={{ color: 'var(--gia-muted)' }}>
          {checking
            ? 'Sending one command and waiting for its result.'
            : status?.ready
              ? 'Commands return stdout, stderr, and an exit code.'
              : status?.installed
                ? status.hint
                : status?.hint || 'Checks the installed Termux package and its RUN_COMMAND bridge.'}
        </p>

        {!checking && status?.installed && !status.ready && (
          <p className="text-[10px] leading-relaxed mt-1.5" style={{ color: 'var(--gia-muted)' }}>
            Add <code className="text-[10px]" style={{ fontFamily: 'var(--gia-font-mono, monospace)', color: 'var(--gia-text)' }}>allow-external-apps = true</code> to{' '}
            <code className="text-[10px]" style={{ fontFamily: 'var(--gia-font-mono, monospace)', color: 'var(--gia-text)' }}>~/.termux/termux.properties</code> and restart Termux.
          </p>
        )}

        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => { void check(); }}
            disabled={checking}
            className="flex items-center gap-1 text-[10px] tap-feedback disabled:opacity-40"
            style={{ color: 'var(--gia-muted)' }}
          >
            <RefreshCw size={9} className={checking ? 'animate-spin' : ''} />
            Check again
          </button>
          {status?.installed && (
            <button
              onClick={() => { void termuxService.open(); }}
              className="flex items-center gap-1 text-[10px] tap-feedback"
              style={{ color: 'var(--gia-muted)' }}
            >
              Open Termux
              <ArrowUpRight size={9} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const TerminalPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="Root Terminal & Linux Shell" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3">
          <TermuxCard />
        </div>
        <SandboxSetupPanel />
      </div>
    </div>
  );
};

export default TerminalPage;
