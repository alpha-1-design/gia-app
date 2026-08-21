import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock, Globe, Search,
  Terminal, Activity, Wifi, AlertTriangle,
  Loader, RefreshCw, MapPin, Bug, Radio,
  Skull, Clock, Filter, CheckCircle2, XCircle, Wrench, Download, RotateCcw, Loader2
} from 'lucide-react';
import {
  securityScan, securityFirewall, securityThreatIntel,
  securityTrace, securityInstallTools, securityQuarantine,
} from '../../services/tools/security';
import { networkScan, networkConnectivity } from '../../services/tools/network';
import SandboxService from '../../services/SandboxService';
import SandboxEnvService, { type SandboxStatus } from '../../services/SandboxEnvService';
import { SubPageHeader } from './SubPageHeader';
import ConfirmDialog from '../ConfirmDialog';

interface ScanResult {
  severity: 'ok' | 'warning' | 'critical';
  summary: string;
  processes: number;
  openPorts: { port: number; service: string; process: string; safe: boolean }[];
  connections: { target: string; port: number; status: string }[];
  suspicious: string[];
  failedAuth: number;
}

interface FirewallStatus {
  method: string;
  active: boolean;
  iptables: boolean;
  hosts: boolean;
}

interface NetworkScanResult {
  host: string;
  openPorts: { port: number; service: string; state: string }[];
  error?: string;
}

interface HealthScore {
  total: number;
  items: { label: string; score: number; max: number; severity: 'ok' | 'warning' | 'critical' }[];
}

const PORT_SERVICES: Record<number, string> = {
  22: 'SSH', 80: 'HTTP', 443: 'HTTPS', 3306: 'MySQL',
  5432: 'PostgreSQL', 6379: 'Redis', 27017: 'MongoDB',
  8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 9090: 'Prometheus',
  3000: 'Dev Server', 5000: 'Flask', 6443: 'K8s API',
  9200: 'Elasticsearch', 15672: 'RabbitMQ', 11211: 'Memcached',
};

const SAFE_PORTS = new Set([80, 443, 53, 123, 8080, 8443, 3000, 5000, 5173, 3081]);

const FINDING_TAGS = ['all', 'ports', 'connections', 'threats', 'processes', 'auth'] as const;
type FindingTag = typeof FINDING_TAGS[number];

const serviceForPort = (p: number): string => PORT_SERVICES[p] || `Port ${p}`;

function parseScanContent(content: string, raw: { ports: string; conns: string }): ScanResult {
  const critical = content.includes('🚨');
  const warning = content.includes('⚠️');
  const severity = critical ? 'critical' : warning ? 'warning' : 'ok';
  const summary = critical ? 'Suspicious processes or threats detected'
    : warning ? 'Unusual items found — review flagged sections'
    : 'No threats detected';
  const suspicious: string[] = [];
  const susLines = content.match(/🚨 Found \d+ suspicious process.*?\n```[\s\S]*?```/);
  if (susLines) {
    const code = susLines[0].match(/```\n([\s\S]*?)```/);
    if (code) suspicious.push(...code[1].split('\n').filter(Boolean));
  }
  const procMatch = content.match(/\*\*Processes:\*\*\s*(\d+)/);
  const processes = procMatch ? parseInt(procMatch[1]) : 0;
  const authMatch = content.match(/\*\*Failed Auth:\*\*\s*(\d+)/);
  const failedAuth = authMatch ? parseInt(authMatch[1]) : 0;
  const ports: ScanResult['openPorts'] = [];
  for (const line of raw.ports.split('\n')) {
    const m = line.match(/:(\d+)\s/);
    if (m) {
      const port = parseInt(m[1]);
      ports.push({ port, service: serviceForPort(port), process: line.trim().slice(0, 40), safe: SAFE_PORTS.has(port) });
    }
  }
  const connections: ScanResult['connections'] = [];
  for (const line of raw.conns.split('\n')) {
    const m = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
    if (m && !line.includes('127.0.0.1')) {
      connections.push({ target: m[1], port: parseInt(m[2]), status: 'ESTABLISHED' });
    }
  }
  return { severity, summary, processes, openPorts: ports, connections, suspicious, failedAuth };
}

async function getFirewallStatus(): Promise<FirewallStatus> {
  const r = await securityFirewall.execute({ action: 'status' });
  const content = r.content;
  return {
    method: content.includes('iptables') ? 'iptables' : content.includes('hosts') ? 'hosts' : 'none',
    active: content.includes('✅') && !content.includes('inactive'),
    iptables: content.includes('✅ available') || content.includes('kernel (iptables)'),
    hosts: content.includes('✅ active') || content.includes('software (hosts)'),
  };
}

async function sandboxRaw(cmd: string, timeout = 10000): Promise<string> {
  try {
    const ok = await SandboxService.ensureAvailable();
    if (ok) {
      const r = await SandboxService.exec(cmd, { timeout });
      return r.stdout || '';
    }
  } catch { /* sandbox unavailable */ }
  return '';
}

function computeHealth(scan: ScanResult | null, firewall: FirewallStatus | null, sandbox: boolean | null): HealthScore {
  const items: HealthScore['items'] = [
    { label: 'Sandbox', score: sandbox ? 100 : 0, max: 100, severity: sandbox ? 'ok' : 'critical' },
    { label: 'Firewall', score: firewall?.active ? 100 : 0, max: 100, severity: firewall?.active ? 'ok' : 'warning' },
  ];
  if (scan) {
    const portScore = scan.openPorts.filter(p => p.safe).length / Math.max(scan.openPorts.length, 1);
    items.push({ label: 'Ports', score: portScore * 100, max: 100, severity: portScore > 0.8 ? 'ok' : portScore > 0.5 ? 'warning' : 'critical' });
    items.push({ label: 'Auth', score: scan.failedAuth === 0 ? 100 : Math.max(0, 100 - scan.failedAuth * 20), max: 100, severity: scan.failedAuth === 0 ? 'ok' : scan.failedAuth < 3 ? 'warning' : 'critical' });
    items.push({ label: 'Threats', score: scan.suspicious.length === 0 ? 100 : Math.max(0, 100 - scan.suspicious.length * 25), max: 100, severity: scan.suspicious.length === 0 ? 'ok' : 'critical' });
  }
  const total = items.reduce((s, i) => s + i.score, 0) / items.length;
  return { total: Math.round(total), items };
}

const MicalPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [sandboxOk, setSandboxOk] = useState<boolean | null>(null);
  const [firewall, setFirewall] = useState<FirewallStatus | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [lookupTarget, setLookupTarget] = useState('');
  const [lookupResult, setLookupResult] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [traceTarget, setTraceTarget] = useState('');
  const [traceResult, setTraceResult] = useState('');
  const [traceLoading, setTraceLoading] = useState(false);
  const [netTarget, setNetTarget] = useState('');
  const [netResult, setNetResult] = useState<NetworkScanResult | null>(null);
  const [netLoading, setNetLoading] = useState(false);
  const [pingTarget, setPingTarget] = useState('');
  const [pingResult, setPingResult] = useState<string>('');
  const [pingLoading, setPingLoading] = useState(false);
  const [showQuarantine, setShowQuarantine] = useState(false);
  const [quarantining, setQuarantining] = useState(false);
  const [quarantineResult, setQuarantineResult] = useState('');
  const [activeTag, setActiveTag] = useState<FindingTag>('all');
  const [lastScan, setLastScan] = useState<number | null>(null);

  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus | null>(null);
  const [sandboxBusy, setSandboxBusy] = useState<null | 'setup' | 'repair' | 'reset'>(null);
  const [sandboxProgress, setSandboxProgress] = useState('');
  const [sandboxOutput, setSandboxOutput] = useState('');
  const [confirmSandboxReset, setConfirmSandboxReset] = useState(false);

  const refreshSandboxStatus = useCallback(async () => {
    const s = await SandboxEnvService.status();
    setSandboxStatus(s);
  }, []);

  useEffect(() => {
    SandboxService.ensureAvailable().then(setSandboxOk);
    getFirewallStatus().then(setFirewall);
    refreshSandboxStatus();
  }, [refreshSandboxStatus]);

  const health = useMemo(() => computeHealth(scanResult, firewall, sandboxOk), [scanResult, firewall, sandboxOk]);

  const doInstall = useCallback(async () => {
    setInstalling(true);
    try {
      const r = await securityInstallTools.execute({});
      setInstalled(r.content.includes('✅'));
    } finally { setInstalling(false); }
  }, []);

  const doScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const [netRaw, connRaw] = await Promise.all([
        sandboxRaw('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "NO_NETSTAT"', 10000),
        sandboxRaw('ss -tnp 2>/dev/null | grep ESTAB || netstat -tnp 2>/dev/null | grep ESTAB || echo "NO_CONNS"', 10000),
      ]);
      const r = await securityScan.execute({ deep: true });
      setScanResult(parseScanContent(r.content, { ports: netRaw, conns: connRaw }));
      setLastScan(Date.now());
    } finally { setScanning(false); }
  }, []);

  const toggleFirewall = useCallback(async () => {
    setBlocking(true);
    try {
      const action = firewall?.active ? 'allow_all' : 'block_all';
      await securityFirewall.execute({ action });
      setFirewall(await getFirewallStatus());
    } finally { setBlocking(false); }
  }, [firewall]);

  const doLookup = useCallback(async () => {
    if (!lookupTarget.trim()) return;
    setLookupLoading(true);
    setLookupResult('');
    try {
      const [traceR, intelR] = await Promise.all([
        securityTrace.execute({ target: lookupTarget.trim() }),
        securityThreatIntel.execute({ targets: [lookupTarget.trim()] }),
      ]);
      setLookupResult(traceR.content + '\n\n---\n\n' + intelR.content);
    } finally { setLookupLoading(false); }
  }, [lookupTarget]);

  const doTrace = useCallback(async () => {
    if (!traceTarget.trim()) return;
    setTraceLoading(true);
    setTraceResult('');
    try {
      const r = await securityTrace.execute({ target: traceTarget.trim() });
      setTraceResult(r.content);
    } finally { setTraceLoading(false); }
  }, [traceTarget]);

  const doNetScan = useCallback(async () => {
    if (!netTarget.trim()) return;
    setNetLoading(true);
    setNetResult(null);
    try {
      const r = await networkScan.execute({ host: netTarget.trim(), ports: '22,80,443,3306,5432,6379,8080,8443,9090,3000,5000,6443,9200,15672,11211' });
      const lines = (r.content || '').split('\n');
      const openPorts: NetworkScanResult['openPorts'] = [];
      for (const line of lines) {
        const m = line.match(/(\d+)\/(tcp|udp)\s+open/);
        if (m) {
          const port = parseInt(m[1]);
          openPorts.push({ port, service: PORT_SERVICES[port] || 'unknown', state: 'open' });
        }
      }
      setNetResult({ host: netTarget.trim(), openPorts, error: r.error || undefined });
    } finally { setNetLoading(false); }
  }, [netTarget]);

  const doPing = useCallback(async () => {
    if (!pingTarget.trim()) return;
    setPingLoading(true);
    setPingResult('');
    try {
      const r = await networkConnectivity.execute({ host: pingTarget.trim(), port: 80, protocol: 'tcp', timeout: 5 });
      setPingResult(r.content);
    } finally { setPingLoading(false); }
  }, [pingTarget]);

  const doQuarantine = useCallback(async () => {
    setQuarantining(true);
    setQuarantineResult('');
    try {
      const r = await securityQuarantine.execute({ confirm: true });
      setQuarantineResult(r.content);
    } finally { setQuarantining(false); setShowQuarantine(false); }
  }, []);

  const severityColor = (s: ScanResult['severity']) =>
    s === 'critical' ? '#f87171' : s === 'warning' ? '#f59e0b' : '#34d399';
  const severityIcon = (s: ScanResult['severity']) =>
    s === 'critical' ? <ShieldAlert size={14} /> : s === 'warning' ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="Mical" onBack={onBack} />

      {/* Health Summary */}
      <div className="rounded-xl p-4 flex items-center gap-4" style={{
        background: health.total >= 80 ? 'rgba(52,211,153,0.06)' : health.total >= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${health.total >= 80 ? 'rgba(52,211,153,0.15)' : health.total >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}`,
      }}>
        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 48 48" width="56" height="56">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle cx="24" cy="24" r="20" fill="none"
              stroke={health.total >= 80 ? '#34d399' : health.total >= 50 ? '#f59e0b' : '#f87171'}
              strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${(health.total / 100) * 125.6} 125.6`}
              transform="rotate(-90 24 24)"
            />
          </svg>
          <span className="text-lg font-bold" style={{ color: health.total >= 80 ? '#34d399' : health.total >= 50 ? '#f59e0b' : '#f87171' }}>
            {health.total}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Device Health</span>
            {lastScan && (
              <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
                <Clock size={9} className="inline mr-0.5" />
                {Math.round((Date.now() - lastScan) / 60000)}m ago
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {health.items.map((item, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: item.severity === 'ok' ? 'rgba(52,211,153,0.08)' : item.severity === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', color: severityColor(item.severity) }}>
                {item.score >= 80 ? <CheckCircle2 size={8} /> : <XCircle size={8} />}
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Alpine Sandbox Connection Banner */}
      {sandboxOk === true && (
        <div className="px-3.5 py-3 rounded-xl text-xs flex items-center justify-between"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div>
              <p className="font-semibold flex items-center gap-1.5" style={{ color: '#34d399' }}>
                <CheckCircle2 size={13} /> Alpine Sandbox Connected & Operational
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>
                {SandboxService.isUsingNativeFallback()
                  ? 'Active on native on-device terminal (proot + Alpine Linux)'
                  : 'Active on Sandbox Server (port 3081) — proot chroot ready'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-medium shrink-0" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
            ACTIVE
          </span>
        </div>
      )}
      {sandboxOk === false && (
        <div className="px-3.5 py-3 rounded-xl text-xs leading-relaxed"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
              <AlertTriangle size={13} /> Sandbox Connection Pending
            </p>
            <button onClick={() => SandboxService.ensureAvailable().then(setSandboxOk)} className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              Retry
            </button>
          </div>
          <p style={{ color: 'var(--gia-muted)' }}>
            Connecting to Alpine Linux Sandbox execution environment...
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-2 px-1">
        <Shield size={14} style={{ color: '#34d399' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Quick Actions</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={doInstall} disabled={installing || installed || sandboxOk === false}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all tap-feedback"
          style={{ background: installed ? 'rgba(52,211,153,0.08)' : 'rgba(99,102,241,0.12)', color: installed ? '#34d399' : '#818cf8', border: `1px solid ${installed ? 'rgba(52,211,153,0.2)' : 'rgba(99,102,241,0.2)'}`, opacity: installing ? 0.6 : 1 }}>
          {installing ? <Loader size={14} className="animate-spin" /> : installed ? <ShieldCheck size={14} /> : <Shield size={14} />}
          {installed ? 'Tools Installed' : 'Install Tools'}
        </button>
        <button onClick={doScan} disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all tap-feedback"
          style={{ background: scanning ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)', opacity: scanning ? 0.6 : 1 }}>
          {scanning ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {scanning ? 'Scanning...' : 'Deep Scan'}
        </button>
        <button onClick={toggleFirewall} disabled={blocking || sandboxOk === false}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all tap-feedback"
          style={{
            background: firewall?.active ? 'rgba(239,68,68,0.12)' : 'rgba(52,211,153,0.12)',
            color: firewall?.active ? '#ef4444' : '#34d399',
            border: `1px solid ${firewall?.active ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`,
            opacity: blocking ? 0.6 : 1,
          }}>
          {blocking ? <Loader size={14} className="animate-spin" /> : firewall?.active ? <Lock size={14} /> : <Unlock size={14} />}
          {firewall?.active ? 'Unblock Traffic' : 'Block All Traffic'}
        </button>
        <button onClick={() => setShowQuarantine(true)} disabled={quarantining || sandboxOk === false}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all tap-feedback"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', opacity: quarantining ? 0.6 : 1 }}>
          {quarantining ? <Loader size={14} className="animate-spin" /> : <Skull size={14} />}
          Quarantine
        </button>
      </div>

      {/* Alpine Sandbox & Build Environment Controls */}
      <div className="flex items-center gap-2 px-1 mt-1">
        <Terminal size={14} style={{ color: '#34d399' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Alpine Sandbox & Build Environment
        </span>
        {sandboxStatus && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{
              background: sandboxStatus.ready ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
              color: sandboxStatus.ready ? '#34d399' : '#f87171',
            }}>
            {sandboxStatus.ready ? 'Ready' : 'Setup Required'}
          </span>
        )}
      </div>
      <div className="gia-card p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {sandboxStatus?.packages.map((p) => (
            <div key={p.key} className="flex items-center gap-3">
              <span className="flex-1 text-xs font-medium" style={{ color: 'var(--gia-text)' }}>
                {p.label}
              </span>
              {p.ok ? (
                <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: '#34d399' }}>
                  <CheckCircle2 size={12} /> {p.version}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: '#f87171' }}>
                  <XCircle size={12} /> missing
                </span>
              )}
            </div>
          ))}
          {!sandboxStatus && <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>Checking environment packages...</p>}
        </div>

        <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            disabled={sandboxBusy !== null}
            onClick={async () => {
              setSandboxBusy('setup');
              setSandboxProgress('Starting full environment setup...');
              setSandboxOutput('');
              const res = await SandboxEnvService.installEnvironment(m => setSandboxProgress(m));
              setSandboxOutput(res.output || '');
              setSandboxBusy(null);
              refreshSandboxStatus();
            }}
            className="flex-1 px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)', opacity: sandboxBusy ? 0.6 : 1 }}
          >
            {sandboxBusy === 'setup' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {sandboxBusy === 'setup' ? 'Installing...' : 'Set Up Environment'}
          </button>
          <button
            disabled={sandboxBusy !== null}
            onClick={async () => {
              setSandboxBusy('repair');
              setSandboxProgress('Repairing...');
              setSandboxOutput('');
              const res = await SandboxEnvService.repair(m => setSandboxProgress(m));
              setSandboxOutput(res.output || '');
              setSandboxBusy(null);
              refreshSandboxStatus();
            }}
            className="px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--gia-text)', border: '1px solid rgba(255,255,255,0.08)', opacity: sandboxBusy ? 0.6 : 1 }}
          >
            {sandboxBusy === 'repair' ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />} Repair
          </button>
          <button
            disabled={sandboxBusy !== null}
            onClick={() => setConfirmSandboxReset(true)}
            className="px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', opacity: sandboxBusy ? 0.6 : 1 }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>

        {sandboxBusy && (
          <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gia-text)' }}>{sandboxProgress}</p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full w-full animate-pulse" style={{ background: '#34d399' }} />
            </div>
          </div>
        )}

        {sandboxOutput && !sandboxBusy && (
          <pre className="p-2.5 rounded-lg text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--gia-muted)' }}>
            {sandboxOutput}
          </pre>
        )}
      </div>

      <ConfirmDialog
        open={confirmSandboxReset}
        title="Reset Alpine Sandbox Environment?"
        message="This removes installed build packages (node, npm, git, gcc, python3). The base rootfs remains intact."
        confirmLabel="Reset Environment"
        danger
        onConfirm={async () => {
          setConfirmSandboxReset(false);
          setSandboxBusy('reset');
          setSandboxProgress('Resetting environment...');
          const res = await SandboxEnvService.reset(m => setSandboxProgress(m));
          setSandboxOutput(res.output || '');
          setSandboxBusy(null);
          refreshSandboxStatus();
        }}
        onCancel={() => setConfirmSandboxReset(false)}
      />

      {/* Quarantine confirmation modal */}
      {showQuarantine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowQuarantine(false)}>
          <div className="mx-4 p-6 rounded-2xl max-w-sm w-full" style={{ background: 'var(--gia-surface)', border: '1px solid rgba(239,68,68,0.3)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <Skull size={20} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Emergency Quarantine</p>
                <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>This will kill processes and block all traffic</p>
              </div>
            </div>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
              Are you sure? This immediately kills suspicious processes, blocks all network traffic via iptables and software-level blocking, and secures the device. Use only when you've detected a confirmed threat.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowQuarantine(false)} className="px-4 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--gia-muted)' }}>Cancel</button>
              <button onClick={doQuarantine} disabled={quarantining} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', opacity: quarantining ? 0.6 : 1 }}>
                {quarantining ? 'Isolating...' : 'Confirm Quarantine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {quarantineResult && (
        <div className="px-3 py-2 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#34d399' }}>
          {quarantineResult}
        </div>
      )}

      {/* Scan Results + Tags */}
      {scanResult && (
        <>
          {/* Findings Tags Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <Filter size={12} style={{ color: 'var(--gia-muted-2)' }} />
            {FINDING_TAGS.map(tag => {
              const count = tag === 'all' ? -1
                : tag === 'ports' ? scanResult.openPorts.length
                : tag === 'connections' ? scanResult.connections.length
                : tag === 'threats' ? scanResult.suspicious.length
                : tag === 'processes' ? scanResult.processes
                : tag === 'auth' ? scanResult.failedAuth
                : 0;
              return (
                <button key={tag} onClick={() => setActiveTag(activeTag === tag ? 'all' : tag)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all shrink-0 flex items-center gap-1.5 ${activeTag === tag ? 'border-violet-500/30 text-violet-400' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                  style={{ background: activeTag === tag ? 'rgba(168,85,247,0.1)' : 'transparent' }}>
                  {tag === 'all' ? 'All' : tag}
                  {count > 0 && <span className="text-[8px] opacity-60">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Scan Results Summary */}
          <div className="gia-card overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3 text-xs font-medium"
              style={{
                background: scanResult.severity === 'critical' ? 'rgba(239,68,68,0.1)' :
                  scanResult.severity === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(52,211,153,0.08)',
                color: severityColor(scanResult.severity),
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
              {severityIcon(scanResult.severity)}
              <span className="flex-1">{scanResult.summary}</span>
            </div>
            <div className="grid grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {[
                { tag: 'processes' as const, label: 'Processes', value: scanResult.processes, icon: <Terminal size={12} />, color: '#a78bfa' },
                { tag: 'ports' as const, label: 'Open Ports', value: scanResult.openPorts.length, icon: <Wifi size={12} />, color: scanResult.openPorts.some(p => !p.safe) ? '#f59e0b' : '#34d399' },
                { tag: 'connections' as const, label: 'Connections', value: scanResult.connections.length, icon: <Globe size={12} />, color: scanResult.connections.length > 5 ? '#f59e0b' : '#34d399' },
                { tag: 'auth' as const, label: 'Failed Auth', value: scanResult.failedAuth, icon: <Lock size={12} />, color: scanResult.failedAuth > 0 ? '#f87171' : '#34d399' },
              ].map((stat, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:opacity-80" style={{ background: 'var(--gia-bg)' }}
                  onClick={() => setActiveTag(activeTag === stat.tag ? 'all' : stat.tag)}>
                  <span style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</span>
                  <div>
                    <p className="text-[18px] font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Ports */}
          {scanResult.openPorts.length > 0 && (activeTag === 'all' || activeTag === 'ports') && (
            <>
              <div className="flex items-center gap-2 px-1 mt-1">
                <Wifi size={14} style={{ color: '#f59e0b' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Open Ports</span>
              </div>
              <div className="gia-card p-0 overflow-hidden">
                {scanResult.openPorts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs"
                    style={{ borderBottom: i < scanResult.openPorts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.safe ? '#34d399' : '#f59e0b' }} />
                    <span className="font-mono font-medium" style={{ color: 'var(--gia-text)', minWidth: 50 }}>{p.port}</span>
                    <span className="font-medium" style={{ color: p.safe ? '#34d399' : '#f59e0b', minWidth: 80 }}>{p.service}</span>
                    <span className="truncate" style={{ color: 'var(--gia-muted)', flex: 1 }}>{p.process}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Network Connections */}
          {scanResult.connections.length > 0 && (activeTag === 'all' || activeTag === 'connections') && (
            <>
              <div className="flex items-center gap-2 px-1 mt-1">
                <Globe size={14} style={{ color: '#3b82f6' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Network Connections</span>
              </div>
              <div className="gia-card p-0 overflow-hidden">
                {scanResult.connections.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs"
                    style={{ borderBottom: i < scanResult.connections.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ color: '#34d399' }}>→</span>
                    <span className="font-mono" style={{ color: 'var(--gia-text)' }}>{c.target}:{c.port}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>{c.status}</span>
                    <span style={{ color: 'var(--gia-muted)', flex: 1 }}>{PORT_SERVICES[c.port] || ''}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Suspicious Processes */}
          {scanResult.suspicious.length > 0 && (activeTag === 'all' || activeTag === 'threats') && (
            <>
              <div className="flex items-center gap-2 px-1 mt-1">
                <Bug size={14} style={{ color: '#f87171' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Suspicious Processes</span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                {scanResult.suspicious.map((s, i) => (
                  <div key={i} className="px-4 py-2 font-mono text-[11px]" style={{ color: '#f87171' }}>{s}</div>
                ))}
              </div>
            </>
          )}

          {/* Failed Auth */}
          {scanResult.failedAuth > 0 && (activeTag === 'all' || activeTag === 'auth') && (
            <>
              <div className="flex items-center gap-2 px-1 mt-1">
                <Lock size={14} style={{ color: '#f87171' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Failed Auth Attempts</span>
              </div>
              <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#f87171' }}>
                {scanResult.failedAuth} failed authentication attempt{scanResult.failedAuth > 1 ? 's' : ''} detected
                {scanResult.failedAuth > 5 ? ' — possible brute force attack in progress' : ''}
              </div>
            </>
          )}
        </>
      )}

      {!scanResult && (
        <div className="px-4 py-6 rounded-xl text-center text-xs" style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--gia-muted)' }}>
          {sandboxOk === false ? 'Sandbox unavailable — use chat commands' : 'Tap "Deep Scan" to run a full security check'}
        </div>
      )}

      {/* Firewall */}
      <div className="flex items-center gap-2 px-1 mt-1">
        <Lock size={14} style={{ color: '#8b5cf6' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Firewall</span>
      </div>
      <div className="gia-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: firewall?.active ? '#34d399' : '#6b7280' }} />
            <span className="text-xs font-medium" style={{ color: firewall?.active ? '#34d399' : 'var(--gia-muted)' }}>
              {firewall ? (firewall.active ? `Active (${firewall.method})` : 'Inactive') : 'Checking...'}
            </span>
          </div>
        </div>
        <div className="flex gap-2 text-[10px]" style={{ color: 'var(--gia-muted)' }}>
          <span style={{ opacity: firewall?.iptables ? 1 : 0.4 }}>🛡️ iptables</span>
          <span style={{ opacity: firewall?.hosts ? 1 : 0.4 }}>📝 hosts</span>
        </div>
      </div>

      {/* Network Scan */}
      <div className="flex items-center gap-2 px-1 mt-1">
        <Radio size={14} style={{ color: '#22d3ee' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Network Scan</span>
      </div>
      <div className="gia-card p-4">
        <div className="flex gap-2 mb-2">
          <input value={netTarget} onChange={e => setNetTarget(e.target.value)} placeholder="Host or IP..." onKeyDown={e => e.key === 'Enter' && doNetScan()}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gia-text)' }} />
          <button onClick={doNetScan} disabled={netLoading || !netTarget.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0"
            style={{ background: netLoading ? 'rgba(34,211,238,0.08)' : 'rgba(34,211,238,0.12)', color: '#22d3ee', opacity: netLoading ? 0.6 : 1 }}>
            {netLoading ? <Loader size={13} className="animate-spin" /> : 'Scan'}
          </button>
        </div>
        {netResult && (
          <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {netResult.openPorts.length === 0 && !netResult.error && <p className="px-3 py-2 text-[11px]" style={{ color: '#34d399' }}>No open ports found on {netResult.host}</p>}
            {netResult.error && <p className="px-3 py-2 text-[11px]" style={{ color: '#f87171' }}>{netResult.error}</p>}
            {netResult.openPorts.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-[11px]" style={{ borderBottom: i < netResult.openPorts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-mono font-medium" style={{ color: 'var(--gia-text)' }}>{p.port}</span>
                <span className="text-emerald-400">{p.service}</span>
                <span className="text-[9px] text-zinc-500">{p.state}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connectivity Test */}
      <div className="flex items-center gap-2 px-1 mt-1">
        <Activity size={14} style={{ color: '#34d399' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Connectivity Test</span>
      </div>
      <div className="gia-card p-4">
        <div className="flex gap-2 mb-2">
          <input value={pingTarget} onChange={e => setPingTarget(e.target.value)} placeholder="Host or IP..." onKeyDown={e => e.key === 'Enter' && doPing()}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gia-text)' }} />
          <button onClick={doPing} disabled={pingLoading || !pingTarget.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0"
            style={{ background: pingLoading ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.12)', color: '#34d399', opacity: pingLoading ? 0.6 : 1 }}>
            {pingLoading ? <Loader size={13} className="animate-spin" /> : 'Ping'}
          </button>
        </div>
        {pingResult && (
          <div className="px-3 py-2 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--gia-text)' }}>
            {pingResult}
          </div>
        )}
      </div>

      {/* Threat Lookup */}
      <div className="flex items-center gap-2 px-1 mt-1">
        <Search size={14} style={{ color: '#f59e0b' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Threat Lookup</span>
      </div>
      <div className="gia-card p-4">
        <div className="flex gap-2 mb-2">
          <input value={lookupTarget} onChange={e => setLookupTarget(e.target.value)} placeholder="IP, domain, or hash..." onKeyDown={e => e.key === 'Enter' && doLookup()}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gia-text)' }} />
          <button onClick={doLookup} disabled={lookupLoading || !lookupTarget.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: lookupLoading ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.12)', color: '#f59e0b', opacity: lookupLoading ? 0.6 : 1 }}>
            {lookupLoading ? <Loader size={13} className="animate-spin" /> : 'Check'}
          </button>
        </div>
        {lookupResult && (
          <div className="px-3 py-2 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto"
            style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--gia-text)' }}>
            {lookupResult}
          </div>
        )}
      </div>

      {/* IP Trace */}
      <div className="flex items-center gap-2 px-1 mt-1">
        <MapPin size={14} style={{ color: '#3b82f6' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>IP Trace</span>
      </div>
      <div className="gia-card p-4">
        <div className="flex gap-2 mb-2">
          <input value={traceTarget} onChange={e => setTraceTarget(e.target.value)} placeholder="IP or domain..." onKeyDown={e => e.key === 'Enter' && doTrace()}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gia-text)' }} />
          <button onClick={doTrace} disabled={traceLoading || !traceTarget.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: traceLoading ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.12)', color: '#3b82f6', opacity: traceLoading ? 0.6 : 1 }}>
            {traceLoading ? <Loader size={13} className="animate-spin" /> : 'Trace'}
          </button>
        </div>
        {traceResult && (
          <div className="px-3 py-2 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto"
            style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--gia-text)' }}>
            {traceResult}
          </div>
        )}
      </div>
    </div>
  );
};

export { MicalPage };
export default MicalPage;
