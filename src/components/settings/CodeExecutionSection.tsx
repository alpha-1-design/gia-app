import React, { useState, useEffect, useCallback } from 'react';
import { Play, Check, X, Save } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import CodeRunner from '../../services/CodeRunner';

export const CodeExecutionSection: React.FC<{ codeEndpoint: string; setCodeEndpoint: (v: string) => void }> = ({ codeEndpoint, setCodeEndpoint }) => {
  const [pistonApiKey, setPistonApiKey] = useState(() => localStorage.getItem('gia-piston-api-key') || '');

  useEffect(() => {
    const savedKey = localStorage.getItem('gia-piston-api-key');
    if (savedKey) CodeRunner.setApiKey(savedKey);
    const savedEndpoint = localStorage.getItem('gia-piston-endpoint');
    if (savedEndpoint) CodeRunner.setEndpoint(savedEndpoint);
  }, []);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [showLangs, setShowLangs] = useState(false);
  const [runtimes, setRuntimes] = useState<{ language: string; version: string }[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(false);

  const handleTest = useCallback(async () => {
    setTestState('testing');
    setTestMsg('');
    const url = codeEndpoint.trim() || CodeRunner.getEndpoint();
    const { ok, message } = await CodeRunner.testEndpoint(url);
    setTestState(ok ? 'ok' : 'fail');
    setTestMsg(message);
  }, [codeEndpoint]);

  const handleLoadLangs = useCallback(async () => {
    if (showLangs) { setShowLangs(false); return; }
    setLoadingLangs(true);
    const runtimes = await CodeRunner.getRuntimes();
    const unique = new Map<string, string>();
    runtimes.forEach((r: { language: string; version: string }) => {
      if (!unique.has(r.language)) unique.set(r.language, r.version);
    });
    setRuntimes(Array.from(unique.entries()).map(([language, version]) => ({ language, version })));
    setLoadingLangs(false);
    setShowLangs(true);
  }, [showLangs]);

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="flex items-center gap-2">
        <Play size={14} style={{ color: '#10b981' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Code Execution
        </span>
      </div>
      <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        Default: Piston API (stateless, 40+ languages). Set a custom endpoint for a persistent sandbox.
      </p>
      <div className="flex gap-2">
        <input
          className="gia-input"
          style={{ fontSize: '11px', flex: 1 }}
          value={codeEndpoint}
          onChange={e => setCodeEndpoint(e.target.value)}
          placeholder="https://your-server.com/api/v2/piston/execute"
        />
        <button
          onClick={() => {
            if (codeEndpoint.trim()) {
              localStorage.setItem('gia-piston-endpoint', codeEndpoint.trim());
              CodeRunner.setEndpoint(codeEndpoint.trim());
              useGiaStore.getState().addNotification('Code endpoint saved');
            } else {
              localStorage.removeItem('gia-piston-endpoint');
              CodeRunner.setEndpoint('');
              useGiaStore.getState().addNotification('Reset to default Piston API');
            }
          }}
          className="gia-btn text-xs px-3 py-2"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
        >
          <Save size={11} /> Save
        </button>
      </div>
      <div className="flex gap-2">
        <input
          className="gia-input"
          style={{ fontSize: '11px', flex: 1 }}
          value={pistonApiKey}
          onChange={e => setPistonApiKey(e.target.value)}
          placeholder="Piston API key (required since Feb 2026)"
          type="password"
        />
        <button
          onClick={() => {
            if (pistonApiKey.trim()) {
              localStorage.setItem('gia-piston-api-key', pistonApiKey.trim());
              CodeRunner.setApiKey(pistonApiKey.trim());
              useGiaStore.getState().addNotification('Piston API key saved');
            } else {
              localStorage.removeItem('gia-piston-api-key');
              CodeRunner.setApiKey('');
              useGiaStore.getState().addNotification('Piston API key cleared');
            }
          }}
          className="gia-btn text-xs px-3 py-2"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
        >
          <Save size={11} /> Save
        </button>
      </div>
      <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
        The public Piston API requires an API key since Feb 15, 2026. Obtain one from EngineerMan on Discord, or self-host your own instance.
      </p>
      <div className="flex gap-2">
        <button onClick={handleTest} className="gia-btn text-[10px] px-2.5 py-1.5" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', flex: 1 }}>
          {testState === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>
        <button onClick={handleLoadLangs} className="gia-btn text-[10px] px-2.5 py-1.5" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7', flex: 1 }}>
          {loadingLangs ? 'Loading...' : showLangs ? 'Hide Languages' : 'Show Languages'}
        </button>
      </div>
      {testState !== 'idle' && (
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: testState === 'ok' ? '#34d399' : '#f87171' }}>
          {testState === 'ok' ? <Check size={11} /> : <X size={11} />}
          {testMsg || (testState === 'ok' ? 'Connected' : 'Failed')}
        </div>
      )}
      {showLangs && (
        <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1">
          {runtimes.map(r => (
            <span key={r.language} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', color: '#c084fc' }}>
              {r.language} {r.version}
            </span>
          ))}
        </div>
      )}
      <details className="mt-1">
        <summary className="text-[10px] cursor-pointer font-medium" style={{ color: 'var(--gia-muted)' }}>
          🖥 Self-host Piston server
        </summary>
        <div className="mt-2 text-[10px] space-y-1.5" style={{ color: 'var(--gia-muted-2)' }}>
          <p><strong>Quick start (Docker):</strong></p>
          <pre className="p-2 rounded-lg text-[9px] overflow-x-auto" style={{ background: '#0d0d14', border: '1px solid var(--gia-border)' }}>
{`docker run -d \\
  --name piston \\
  -p 2000:2000 \\
  -e PISTON_REPO_URL="" \\
  ghcr.io/engineerman/piston:latest`}
          </pre>
          <p>Then set endpoint to <code>http://localhost:2000</code>. No API key needed for local instances.</p>
          <p><strong>Or run without Docker (requires Node.js):</strong></p>
          <pre className="p-2 rounded-lg text-[9px] overflow-x-auto" style={{ background: '#0d0d14', border: '1px solid var(--gia-border)' }}>
{`git clone https://github.com/engineerman/piston
cd piston
npm install
node index.js`}</pre>
          <p>Install runtimes inside the container: <code>docker exec piston node /piston/index.js install python</code></p>
        </div>
      </details>
      <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
        {codeEndpoint ? `Custom: ${codeEndpoint}` : 'Default: emkc.org Piston API'}
      </p>
    </div>
  );
};
