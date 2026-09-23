import React, { useEffect, useState } from 'react';
import { Activity, Camera, ChevronRight, Cpu, FileText, Globe, HardDrive, LockKeyhole, Mic, MessageSquare, PlugZap, Settings2, Smartphone } from 'lucide-react';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { isNativePlatform } from '../../utils/helpers';
import LocalLLMService from '../../services/LocalLLMService';
import SandboxService from '../../services/SandboxService';
import MCPManager from '../../services/MCPManager';
import { useMCPStore } from '../../store/useMCPStore';
import { useProviderStore } from '../../store/useProviderStore';
import { SubPageHeader } from './SubPageHeader';

type State = 'ready' | 'needs_setup' | 'needs_permission' | 'unavailable' | 'fallback';
type Capability = { id: string; label: string; detail: string; state: State; icon: React.ReactNode; action?: string; route?: string };

const STATE_LABEL: Record<State, string> = {
  ready: 'Ready',
  needs_setup: 'Needs setup',
  needs_permission: 'Permission needed',
  unavailable: 'Unavailable',
  fallback: 'Browser fallback',
};

const STATE_COLOR: Record<State, string> = {
  ready: '#34d399',
  needs_setup: '#fbbf24',
  needs_permission: '#fb923c',
  unavailable: '#f87171',
  fallback: '#60a5fa',
};

export const CapabilityCenterPage: React.FC<{ onBack: () => void; onNavigate: (page: string) => void }> = ({ onBack, onNavigate }) => {
  const native = isNativePlatform();
  const providers = useProviderStore(s => s.providers);
  const mcpServers = useMCPStore(s => s.servers);
  const connections = useMCPStore(s => s.connections);
  const [permissions, setPermissions] = useState({ camera: 'unknown', location: 'unknown' });
  const [sandboxReady, setSandboxReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      CapacitorCamera.checkPermissions().then(result => result.camera).catch(() => 'unknown'),
      Geolocation.checkPermissions().then(result => result.location).catch(() => 'unknown'),
      SandboxService.ensureAvailable().catch(() => false),
    ]).then(([camera, location, sandbox]) => {
      if (!cancelled) {
        setPermissions({ camera, location });
        setSandboxReady(sandbox);
      }
    });
    MCPManager.init().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const hasProvider = Object.values(providers).some(provider => provider.enabled && !!provider.apiKey);
  const activeLocal = LocalLLMService.getLoadedModel();
  const connectedMcp = mcpServers.filter(server => connections[server.id]?.status === 'connected').length;
  const microphone = typeof navigator !== 'undefined' && 'mediaDevices' in navigator;
  const notifications = typeof Notification !== 'undefined' && Notification.permission === 'granted';

  const capabilities: Capability[] = [
    {
      id: 'assistant',
      label: 'GIA core assistant',
      detail: native ? 'Phone-native shell and Capacitor bridge detected.' : 'Running in browser compatibility mode.',
      state: native ? 'ready' : 'fallback',
      icon: <Smartphone size={16} />,
    },
    {
      id: 'providers',
      label: 'AI providers',
      detail: hasProvider ? 'At least one provider is configured.' : 'Connect a provider or load an on-device model.',
      state: hasProvider ? 'ready' : 'needs_setup',
      icon: <Globe size={16} />,
      action: 'Open provider settings',
      route: 'connections',
    },
    {
      id: 'local',
      label: 'On-device AI',
      detail: activeLocal ? `Loaded: ${activeLocal.split('/').pop()}` : 'Download and load a model for private offline chat.',
      state: activeLocal ? 'ready' : 'needs_setup',
      icon: <Cpu size={16} />,
      action: 'Open Local AI',
      route: 'local-ai',
    },
    {
      id: 'camera',
      label: 'Camera and pictures',
      detail: !native ? 'Browser camera picker is available when supported.' : permissions.camera === 'granted' ? 'Camera permission granted.' : 'GIA needs camera permission to take and analyze photos.',
      state: !native ? 'fallback' : permissions.camera === 'granted' ? 'ready' : permissions.camera === 'denied' ? 'needs_permission' : 'needs_setup',
      icon: <Camera size={16} />,
      action: 'Open System settings',
      route: 'system',
    },
    {
      id: 'microphone',
      label: 'Microphone and voice',
      detail: microphone ? 'Voice input is available; permission is requested when you start listening.' : 'No microphone input is exposed in this environment.',
      state: microphone ? 'ready' : 'unavailable',
      icon: <Mic size={16} />,
      action: 'Open Voice settings',
      route: 'system',
    },
    {
      id: 'location',
      label: 'Location',
      detail: !native ? 'Browser geolocation is available after user approval.' : permissions.location === 'granted' ? 'Location permission granted.' : 'GIA can use location only after you approve it.',
      state: !native ? 'fallback' : permissions.location === 'granted' ? 'ready' : permissions.location === 'denied' ? 'needs_permission' : 'needs_setup',
      icon: <Activity size={16} />,
      action: 'Open System settings',
      route: 'system',
    },
    {
      id: 'files',
      label: 'Files and documents',
      detail: native ? 'Use the on-device workspace and file tools.' : 'Browser mode can read uploads and save downloads.',
      state: native ? 'ready' : 'fallback',
      icon: <FileText size={16} />,
      action: native ? 'Open Terminal' : 'Open Knowledge Base',
      route: native ? 'terminal' : 'knowledge',
    },
    {
      id: 'terminal',
      label: 'Linux terminal',
      detail: sandboxReady ? 'Sandbox is available for local tools and document generation.' : 'Install the on-device Linux environment to unlock local tools.',
      state: sandboxReady ? 'ready' : 'needs_setup',
      icon: <HardDrive size={16} />,
      action: 'Open Terminal',
      route: 'terminal',
    },
    {
      id: 'mcp',
      label: 'MCP tools',
      detail: connectedMcp > 0 ? `${connectedMcp} server${connectedMcp === 1 ? '' : 's'} connected.` : 'Connect hosted MCP servers to extend GIA.',
      state: connectedMcp > 0 ? 'ready' : 'needs_setup',
      icon: <PlugZap size={16} />,
      action: 'Open MCP',
      route: 'mcp',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      detail: notifications ? 'Notifications are enabled.' : 'Enable notifications for reminders and background responses.',
      state: notifications ? 'ready' : native ? 'needs_setup' : 'fallback',
      icon: <MessageSquare size={16} />,
      action: 'Open System settings',
      route: 'system',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '14px' }}>
      <SubPageHeader title="GIA Capabilities" onBack={onBack} />
      <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.14), rgba(6,182,212,0.08))', border: '1px solid rgba(168,85,247,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 size={16} style={{ color: '#c084fc' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>What GIA can do on this phone</p>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
          This is a live inventory, not a promise. GIA will use a capability only when it is available and permitted.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {capabilities.map(capability => {
          const color = STATE_COLOR[capability.state];
          const clickable = !!capability.route;
          return (
            <button key={capability.id} onClick={() => capability.route && onNavigate(capability.route)} disabled={!clickable}
              className="w-full text-left rounded-2xl p-3 transition-colors disabled:cursor-default"
              style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ color, background: `${color}18` }}>{capability.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{capability.label}</p>
                    <span className="text-[9px] font-semibold" style={{ color }}>{STATE_LABEL[capability.state]}</span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{capability.detail}</p>
                </div>
                {capability.route && <ChevronRight size={14} style={{ color: 'var(--gia-muted-2)' }} />}
              </div>
              {capability.action && capability.state !== 'ready' && (
                <div className="flex items-center gap-1 mt-2 ml-12 text-[10px] font-medium" style={{ color }}>{capability.action} <ChevronRight size={10} /></div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-start gap-2 px-1 pb-4 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        <LockKeyhole size={12} className="shrink-0 mt-0.5" />
        <span>Permissions are requested only when a feature needs them. You can revoke them any time in Android Settings.</span>
      </div>
    </div>
  );
};

export default CapabilityCenterPage;
