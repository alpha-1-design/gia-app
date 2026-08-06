import React, { useState, useEffect } from 'react';
import {
  Smartphone, Mic, Camera, MessageSquare, RefreshCw,
  Eye, Cpu, CheckCircle2, Sparkles, Layers, Activity,
} from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import { useProviderStore } from '../../store/useProviderStore';
import { useTaskStore } from '../../store/useTaskStore';
import { handleWidgetAction } from '../../hooks/useNativeIntents';
import { GIAScreenAgent } from '../../services/GIAScreenAgent';
import { MetricWidgetVisual } from '../visual/MetricWidgetVisual';

export const WidgetSection: React.FC = () => {
  const setModule = useGiaStore(s => s.setModule);
  const addNotification = useGiaStore(s => s.addNotification);

  const activeProviderKey = useProviderStore(s => s.activeProvider);
  const providers = useProviderStore(s => s.providers);
  const tasks = useTaskStore(s => s.tasks);

  const activeConfig = providers[activeProviderKey];
  const providerConnected = Boolean(activeConfig?.apiKey?.trim() || activeConfig?.enabled);
  const providerName = activeProviderKey ? activeProviderKey.toUpperCase() : 'GIA AI';

  const pendingTasks = tasks.filter(t => t.status !== 'done');

  // Orb status
  const [orbShowing, setOrbShowing] = useState(false);
  const [orbSize, setOrbSize] = useState(48);

  // Time state for widget simulator
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    GIAScreenAgent.isOrbShowing().then((res: { showing: boolean; size: number }) => {
      setOrbShowing(res.showing);
      if (res.size) setOrbSize(res.size);
    }).catch(() => setOrbShowing(false));
  }, []);

  const toggleOrb = async () => {
    try {
      if (orbShowing) {
        await GIAScreenAgent.hideOrb();
        setOrbShowing(false);
        addNotification('Screen Orb hidden');
      } else {
        await GIAScreenAgent.showOrb();
        setOrbShowing(true);
        addNotification('Screen Orb activated');
      }
    } catch {
      addNotification('Screen Orb toggled');
      setOrbShowing(!orbShowing);
    }
  };

  const handleTestVoice = () => {
    handleWidgetAction('voice_start');
  };

  const handleTestCapture = () => {
    handleWidgetAction('screen_capture');
  };

  const handleTestChat = () => {
    handleWidgetAction('open_chat');
  };

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateString = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // Sample widget data for MetricWidgetVisual preview
  const sampleMetrics = [
    { type: 'widget', data: { label: 'Active Provider', value: providerName, icon: 'globe', color: '#a855f7' } },
    { type: 'widget', data: { label: 'Pending Tasks', value: pendingTasks.length, unit: 'items', icon: 'tasks', color: '#3b82f6' } },
    { type: 'widget', data: { label: 'System Memory', value: 38, unit: '%', change: -2, icon: 'ram', color: '#10b981' } },
    { type: 'widget', data: { label: 'AI Health', value: providerConnected ? 'Optimal' : 'Offline', icon: 'heart', color: providerConnected ? '#10b981' : '#f87171' } },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Panel Header Banner */}
      <div className="gia-card p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(168,85,247,0.06)', borderColor: 'rgba(168,85,247,0.2)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
          <Layers size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold" style={{ color: 'var(--gia-text)' }}>Widgets & Screen Overlay</h3>
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
            Configure Android Home Screen Glance widgets, floating Screen Agent Orb overlay, and in-chat metric visual cards.
          </p>
        </div>
      </div>

      {/* 1. Android Home Screen Widget Simulator */}
      <div className="gia-card p-4 rounded-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={16} style={{ color: '#a855f7' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--gia-text)' }}>
              Android Home Screen Widget
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
            Jetpack Glance
          </span>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>
          Interactive simulator of the Glance home screen widget installed on your Android device. Tap action buttons below to test live intent integration:
        </p>

        {/* Live Widget Phone Frame Preview */}
        <div className="p-4 rounded-2xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-white font-mono">{timeString}</div>
              <div className="text-xs font-medium text-gray-400">{dateString}</div>
            </div>

            {/* Provider Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: providerConnected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${providerConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: providerConnected ? '#34d399' : '#f87171' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: providerConnected ? '#34d399' : '#f87171' }} />
              {providerName}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="grid grid-cols-3 gap-2 my-3">
            <button
              onClick={handleTestVoice}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl transition-all tap-feedback"
              style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}
            >
              <Mic size={18} className="mb-1" />
              <span className="text-[10px] font-bold">Voice</span>
            </button>

            <button
              onClick={handleTestCapture}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl transition-all tap-feedback"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}
            >
              <Camera size={18} className="mb-1" />
              <span className="text-[10px] font-bold">Capture</span>
            </button>

            <button
              onClick={handleTestChat}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl transition-all tap-feedback"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
            >
              <MessageSquare size={18} className="mb-1" />
              <span className="text-[10px] font-bold">Chat</span>
            </button>
          </div>

          {/* Widget Bottom Stats */}
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span>{pendingTasks.length} tasks remaining</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-purple-400">
              <Sparkles size={10} />
              <span>GIA Glance Widget</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Status: Active & Registered</span>
          <button
            onClick={() => addNotification('🔄 Home screen widget refreshed')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tap-feedback"
            style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
          >
            <RefreshCw size={12} />
            Refresh Widget
          </button>
        </div>
      </div>

      {/* 2. Floating Screen Orb Service */}
      <div className="gia-card p-4 rounded-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={16} style={{ color: '#3b82f6' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--gia-text)' }}>
              Screen Agent Orb
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: orbShowing ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)', color: orbShowing ? '#34d399' : '#94a3b8' }}>
            {orbShowing ? 'Active' : 'Standby'}
          </span>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>
          The Screen Agent Orb floats above all Android applications to grant instantaneous access to screen analysis, voice queries, and context awareness.
        </p>

        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--gia-text)' }}>Enable Floating Screen Orb</p>
            <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Overlay on Android screen</p>
          </div>
          <button
            onClick={toggleOrb}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${orbShowing ? 'bg-purple-600' : 'bg-gray-600'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${orbShowing ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {orbShowing && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Activity size={16} style={{ color: '#3b82f6' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--gia-text)' }}>Orb Size: {orbSize}px</p>
              <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Tap orb to talk, drag to reposition, long-press for screen capture.</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. In-Chat Metric Visual Cards */}
      <div className="gia-card p-4 rounded-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={16} style={{ color: '#10b981' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--gia-text)' }}>
              In-Chat Metric Visual Cards
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            Markdown Widget
          </span>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>
          GIA generates rich metric cards inside conversation threads when summarizing stats, weather, server logs, or tasks.
        </p>

        {/* Live Metric Visual Cards Demo */}
        <MetricWidgetVisual data={sampleMetrics as never} />

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Supported in standard Chat & Analyst modules</span>
          <button
            onClick={() => {
              setModule('chat');
              addNotification('💬 Switched to Chat to view widgets');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tap-feedback"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
          >
            Open Chat
          </button>
        </div>
      </div>
    </div>
  );
};
