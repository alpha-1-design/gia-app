import React, { useState } from 'react';
import { Plus, X, Upload, FileCode, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { usePluginStore } from '../../store/usePluginStore';
import PluginManager from '../../services/PluginManager';
import { addNotification } from '../../store/useGiaStore';

export const PluginInstallSection: React.FC = () => {
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleInstall = async () => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    setResult(null);

    try {
      // Fetch plugin manifest
      const response = await fetch(installUrl.trim());
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const manifest = await response.json();

      // Validate manifest
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.description) {
        throw new Error('Invalid plugin manifest: missing required fields (id, name, version, description)');
      }

      // Fetch hooks/setup
      let hooksUrl = installUrl.trim().replace(/manifest\.json$/, 'index.js');
      if (hooksUrl === installUrl.trim()) {
        hooksUrl = installUrl.trim().replace(/\.json$/, '.js');
      }
      let hooks = {};
      let setup = undefined;

      try {
        const moduleResponse = await fetch(hooksUrl);
        if (moduleResponse.ok) {
          const moduleText = await moduleResponse.text();
          // Simple eval for hooks - in production you'd want sandboxing
          const exports = {};
          const module = { exports };
          new Function('exports', 'module', moduleText)(exports, module);
          hooks = module.exports.hooks || {};
          setup = module.exports.setup;
        }
      } catch {
        // Hooks optional
      }

      await PluginManager.register(manifest, hooks, setup);
      setResult({ success: true, message: `Plugin "${manifest.name}" installed successfully!` });
      setInstallUrl('');
      addNotification(`Plugin installed: ${manifest.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Installation failed';
      setResult({ success: false, message: msg });
    } finally {
      setInstalling(false);
    }
  };

  const handleFileInstall = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const manifest = JSON.parse(content);
        
        if (!manifest.id || !manifest.name || !manifest.version || !manifest.description) {
          throw new Error('Invalid plugin manifest');
        }

        await PluginManager.register(manifest, {}, undefined);
        setResult({ success: true, message: `Plugin "${manifest.name}" installed from file!` });
        addNotification(`Plugin installed: ${manifest.name}`);
      } catch (err) {
        setResult({ success: false, message: err instanceof Error ? err.message : 'File parse failed' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="flex items-center gap-2">
        <Plus size={14} style={{ color: '#a855f7' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Install Plugin
        </span>
      </div>

      <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
        Install plugins from a manifest URL (GitHub raw, Gist, or any HTTPS endpoint).
        Manifest must include: id, name, version, description. Optional: hooks, setup.
      </p>

      <div className="flex gap-2">
        <input
          className="gia-input"
          value={installUrl}
          onChange={e => setInstallUrl(e.target.value)}
          placeholder="https://example.com/plugin/manifest.json"
          style={{ fontSize: '11px', flex: 1 }}
          disabled={installing}
        />
        <button
          onClick={handleInstall}
          disabled={installing || !installUrl.trim()}
          className="gia-btn text-xs px-3 py-2 flex items-center gap-1"
          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' }}
        >
          {installing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {installing ? 'Installing...' : 'Install'}
        </button>
      </div>

      <label className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed text-[10px] cursor-pointer transition-colors"
        style={{ 
          borderColor: 'var(--gia-border)', 
          color: 'var(--gia-muted)',
          background: 'rgba(255,255,255,0.02)'
        }}>
        <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileInstall(e.target.files[0])} />
        <FileCode size={14} /> Or drop a manifest.json file
      </label>

      {result && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-[10px] ${result.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}
          style={{ border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          {result.success ? (
            <CheckCircle size={12} style={{ color: '#34d399' }} />
          ) : (
            <AlertCircle size={12} style={{ color: '#f87171' }} />
          )}
          <span style={{ color: result.success ? '#34d399' : '#f87171' }}>{result.message}</span>
        </div>
      )}

      <details className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        <summary className="cursor-pointer mb-1">Manifest format example</summary>
        <pre className="p-2 rounded text-[9px] overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--gia-text)' }}>
{`{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does something cool",
  "author": "You",
  "homepage": "https://github.com/you/plugin"
}`}</pre>
      </details>
    </div>
  );
};

export default PluginInstallSection;