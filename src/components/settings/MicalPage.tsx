import React, { useState, useCallback, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock, Globe, Search,
  Terminal, Activity, Wifi, AlertTriangle,
  Loader, RefreshCw, MapPin, Bug,
} from 'lucide-react';
import {
  securityScan, securityFirewall, securityThreatIntel,
  securityTrace, securityInstallTools,
} from '../../services/tools/security';
import SandboxService from '../../services/SandboxService';
import { SubPageHeader } from './SubPageHeader';

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

const PORT_SERVICES: Record<number, string> = {
  22: 'SSH', 80: 'HTTP', 443: 'HTTPS', 3306: 'MySQL',
  5432: 'PostgreSQL', 6379: 'Redis', 27017: 'MongoDB',
  8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 9090: 'Prometheus',
  3000: 'Dev Server', 5000: 'Flask', 6443: 'K8s API',
  9200: 'Elasticsearch', 15672: 'RabbitMQ', 11211: 'Memcached',
};

const SAFE_PORTS = new Set([80, 443, 53, 123, 8080, 8443, 3000, 5000, 5173, 3081]);

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

  useEffect(() => {
    SandboxService.ensureAvailable().then(setSandboxOk);
    getFirewallStatus().then(setFirewall);
  }, []);

  const doInstall = useCallback(async () => {
    setInstalling(true);
    try {
      const r = await securityInstallTools.execute({});
      setInstalled(r.content.includes('✅'));
    } finally {
      setInstalling(false);
    }
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
    } finally {
      setScanning(false);
    }
  }, []);

  const toggleFirewall = useCallback(async () => {
    setBlocking(true);
    try {
      const action = firewall?.active ? 'allow_all' : 'block_all';
      await securityFirewall.execute({ action });
      setFirewall(await getFirewallStatus());
    } finally {
      setBlocking(false);
    }
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
    } finally {
      setLookupLoading(false);
    }
  }, [lookupTarget]);

  const doTrace = useCallback(async () => {
    if (!traceTarget.trim()) return;
    setTraceLoading(true);
    setTraceResult('');
    try {
      const r = await securityTrace.execute({ target: traceTarget.trim() });
      setTraceResult(r.content);
    } finally {
      setTraceLoading(false);
    }
  }, [traceTarget]);

  const severityColor = (s: ScanResult['severity']) =>
    s === 'critical' ? '#f87171' : s === 'warning' ? '#f59e0b' : '#34d399';
  const severityIcon = (s: ScanResult['severity']) =>
    s === 'critical' ? <ShieldAlert size={14} /> : s === 'warning' ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="Mical" onBack={onBack} />

      {/* Info banner */}
      {sandboxOk === false && (
        <div className="px-3 py-3 rounded-xl text-xs leading-relaxed"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <p className="font-semibold mb-1" style={{ color: '#f59e0b' }}>⚠️ Sandbox not available</p>
          <p style={{ color: 'var(--gia-muted)' }}>
            The Alpine sandbox server isn't running. Start it with{' '}
            <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 4 }}>
              node server/sandbox-server.cjs
            </code>{' '}
            in the project root, or use chat commands like <em>security_scan</em>.
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
      </div>

      {/* Scan Results */}
      <div className="flex items-center gap-2 px-1">
        <Activity size={14} style={{ color: '#a855f7' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Scan Results</span>
      </div>
      {scanResult ? (
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
              { label: 'Processes', value: scanResult.processes, icon: <Terminal size={12} />, color: '#a78bfa' },
              { label: 'Open Ports', value: scanResult.openPorts.length, icon: <Wifi size={12} />, color: scanResult.openPorts.some(p => !p.safe) ? '#f59e0b' : '#34d399' },
              { label: 'Connections', value: scanResult.connections.length, icon: <Globe size={12} />, color: scanResult.connections.length > 5 ? '#f59e0b' : '#34d399' },
              { label: 'Failed Auth', value: scanResult.failedAuth, icon: <Lock size={12} />, color: scanResult.failedAuth > 0 ? '#f87171' : '#34d399' },
            ].map((stat, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3" style={{ background: 'var(--gia-bg)' }}>
                <span style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</span>
                <div>
                  <p className="text-[18px] font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-4 py-6 rounded-xl text-center text-xs" style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--gia-muted)' }}>
          {sandboxOk === false ? 'Sandbox unavailable — use chat commands' : 'Tap "Deep Scan" to run a full security check'}
        </div>
      )}

      {/* Open Ports */}
      {scanResult && scanResult.openPorts.length > 0 && (
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
      {scanResult && scanResult.connections.length > 0 && (
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
      {scanResult && scanResult.suspicious.length > 0 && (
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

      {/* Threat Lookup */}
      <div className="flex items-center gap-2 px-1 mt-1">
        <Search size={14} style={{ color: '#f59e0b' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Threat Lookup</span>
      </div>
      <div className="gia-card p-4">
        <div className="flex gap-2 mb-2">
          <input
            value={lookupTarget}
            onChange={e => setLookupTarget(e.target.value)}
            placeholder="IP, domain, or hash..."
            onKeyDown={e => e.key === 'Enter' && doLookup()}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gia-text)' }}
          />
          <button onClick={doLookup} disabled={lookupLoading || !lookupTarget.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: lookupLoading ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.12)', color: '#f59e0b', opacity: lookupLoading ? 0.6 : 1 }}>
            {lookupLoading ? <Loader size={13} className="animate-spin" /> : 'Check'}
          </button>
        </div>
        {lookupResult && (
          <div className="px-3 py-2 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed"
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
          <input
            value={traceTarget}
            onChange={e => setTraceTarget(e.target.value)}
            placeholder="IP or domain..."
            onKeyDown={e => e.key === 'Enter' && doTrace()}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gia-text)' }}
          />
          <button onClick={doTrace} disabled={traceLoading || !traceTarget.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: traceLoading ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.12)', color: '#3b82f6', opacity: traceLoading ? 0.6 : 1 }}>
            {traceLoading ? <Loader size={13} className="animate-spin" /> : 'Trace'}
          </button>
        </div>
        {traceResult && (
          <div className="px-3 py-2 rounded-lg text-[11px] font-mono whitespace-pre-wrap leading-relaxed"
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
