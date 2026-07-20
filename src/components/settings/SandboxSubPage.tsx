import React, { useState, useEffect, useCallback } from 'react';
import { SubPageHeader } from './SubPageHeader';
import { SandboxEnvService, type SandboxStatus } from '../../services/SandboxEnvService';
import { isNativePlatform } from '../../utils/helpers';
import { useGiaStore } from '../../store/useGiaStore';
import { CheckCircle2, XCircle, AlertTriangle, Download, Wrench, RotateCcw, Terminal, Loader2 } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';

type Busy = null | 'setup' | 'repair' | 'reset';

const SandboxSubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState('');
  const [output, setOutput] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const addNotification = useGiaStore((s) => s.addNotification);

  const refresh = useCallback(async () => {
    setStatus(await SandboxEnvService.status());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = async (kind: Busy, fn: (m: (msg: string) => void) => Promise<{ success: boolean; output: string }>) => {
    if (!kind) return;
    setBusy(kind);
    setProgress('Starting…');
    setOutput('');
    const res = await fn((m) => setProgress(m));
    setOutput(res.output || '');
    setBusy(null);
    await refresh();
    addNotification(res.success ? 'Sandbox updated' : 'Sandbox update failed — see output');
  };

  const native = isNativePlatform();
  const available = status?.available;
  const ready = status?.ready;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}
    >
      <SubPageHeader title="Sandbox & Build Environment" onBack={onBack} />

      {!native && (
        <div className="gia-card p-4" style={{ borderColor: 'rgba(249,115,22,0.3)' }}>
          <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>
            The on-device sandbox runs inside GIA's native terminal (Android proot+Alpine). On desktop/web, builds use the
            Sandbox server instead. The tools below provision that environment.
          </p>
        </div>
      )}

      {/* Status */}
      <div className="gia-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Terminal size={14} style={{ color: '#34d399' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
            Environment
          </span>
          {status && (
            <span
              className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: ready ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                color: ready ? '#34d399' : '#f87171',
              }}
            >
              {ready ? 'Ready' : 'Not set up'}
            </span>
          )}
        </div>

        {!available && status && (
          <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>
            Native terminal not available on this device.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {status?.packages.map((p) => (
            <div key={p.key} className="flex items-center gap-3">
              <span className="flex-1 text-sm" style={{ color: 'var(--gia-text)' }}>
                {p.label}
              </span>
              {p.ok ? (
                <span className="flex items-center gap-1 text-[11px]" style={{ color: '#34d399' }}>
                  <CheckCircle2 size={13} /> {p.version}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px]" style={{ color: '#f87171' }}>
                  <XCircle size={13} /> missing
                </span>
              )}
            </div>
          ))}
          {!status && <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>Checking…</p>}
        </div>

        {status && !status.resolv && (
          <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={11} /> DNS (resolv.conf) missing — setup will add it.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          disabled={busy !== null || !available}
          onClick={() => runAction('setup', SandboxEnvService.provision)}
          className="gia-btn gia-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {busy === 'setup' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy === 'setup' ? 'Installing…' : 'Set up build environment'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={busy !== null || !available}
            onClick={() => runAction('repair', SandboxEnvService.repair)}
            className="gia-btn w-full flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ border: '1px solid var(--gia-border)' }}
          >
            {busy === 'repair' ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />} Repair
          </button>
          <button
            disabled={busy !== null || !available}
            onClick={() => setConfirmReset(true)}
            className="gia-btn w-full flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ border: '1px solid var(--gia-border)' }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Progress */}
      {busy && (
        <div className="gia-card p-4">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--gia-text)' }}>
            {progress}
          </p>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full w-full animate-pulse"
              style={{ background: 'linear-gradient(90deg,#34d399,#10b981)' }}
            />
          </div>
        </div>
      )}

      {/* Output */}
      {output && !busy && (
        <div className="gia-card p-3">
          <pre
            className="text-[10px] whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
            style={{ color: 'var(--gia-muted)' }}
          >
            {output}
          </pre>
        </div>
      )}

      <p className="text-[10px] px-1" style={{ color: 'var(--gia-muted-2)' }}>
        Installed packages persist in the on-device Alpine rootfs. The same environment is reachable from the terminal and
        from Build Mode — so apps you build can actually run and preview in-app.
      </p>

      <ConfirmDialog
        open={confirmReset}
        title="Reset sandbox environment?"
        message="This removes all installed packages (node, npm, git, build tools). The base rootfs stays. You can reinstall anytime from Set up."
        confirmLabel="Reset"
        danger
        onConfirm={() => {
          setConfirmReset(false);
          runAction('reset', SandboxEnvService.reset);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};

export default SandboxSubPage;
