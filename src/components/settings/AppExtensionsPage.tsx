import React from 'react';
import { Puzzle, Smartphone, Code2 } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { PluginSection } from './PluginSection';
import { PluginInstallSection } from './PluginInstallSection';
import { CodeHistorySection } from './CodeHistorySection';
import { DeveloperSettings } from './DeveloperSettings';
import { InstallSection } from './InstallSection';

export const AppExtensionsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
    <SubPageHeader title="App & Extensions" onBack={onBack} />

    <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', color: 'var(--gia-muted)' }}>
      <p className="font-semibold mb-2" style={{ color: '#a855f7' }}>About this panel</p>
      <p className="mb-2">Extend GIA beyond the built-in features. Plugins add new capabilities, code history lets you review past executions, and developer settings unlock advanced controls.</p>
      <ul className="space-y-1.5 pl-3" style={{ listStyle: 'disc' }}>
        <li><strong style={{ color: '#a855f7' }}>Plugins</strong> — Install and manage plugins that extend GIA with new hooks and behaviours. Each plugin can be toggled on/off. Plugins use the Plugin API and run in a sandboxed scope.</li>
        <li><strong style={{ color: '#a855f7' }}>Plugin Install</strong> — Add new plugins by URL or local file. Plugins are loaded dynamically and validated before activation. See the plugin documentation for the manifest format.</li>
        <li><strong style={{ color: '#a855f7' }}>Code History</strong> — Review all code GIA has executed through the sandbox. Each entry shows the code, language, output, and timestamp. Useful for auditing what GIA ran and debugging.</li>
        <li><strong style={{ color: '#a855f7' }}>Install APK</strong> — On Android, scan the QR code to download the latest APK from GitHub Releases. Also shows the release page for direct download.</li>
        <li><strong style={{ color: '#a855f7' }}>Developer Settings</strong> — Advanced: toggle debug mode, view logs, configure the HuggingFace token (for gated models), clear caches, enable experimental features like the in-app terminal.</li>
      </ul>
      <p className="mt-2 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        Tip: Most users won't need plugins — start without them. Developer settings are useful if you're contributing to GIA or testing experimental features. The HuggingFace token here is only needed for gated/private models; free models work without it.
      </p>
    </div>

    <div className="flex items-center gap-2 px-1">
      <Puzzle size={14} style={{ color: '#a855f7' }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Extensions</span>
    </div>
    <PluginSection />
    <PluginInstallSection />
    <CodeHistorySection />

    <div className="flex items-center gap-2 px-1 mt-2">
      <Smartphone size={14} style={{ color: '#3b82f6' }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>App</span>
    </div>
    <InstallSection />

    <div className="flex items-center gap-2 px-1 mt-2">
      <Code2 size={14} style={{ color: '#22c55e' }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Developer</span>
    </div>
    <DeveloperSettings />
  </div>
);
