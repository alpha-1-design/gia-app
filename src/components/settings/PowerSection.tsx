import React, { useEffect, useState } from 'react';
import { Activity, Battery, BatteryCharging, Cpu, MessageSquare, Moon, Radio, Vibrate, Wind } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useGiaStore } from '../../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';
import { Switch } from '../ui/Switch';
import { GIAWakeWord } from '../../services/GIAWakeWord';

export const PowerSection: React.FC = () => {
  const {
    longRunningMode, setLongRunningMode, autoModelUnload, setAutoModelUnload,
    hapticFeedback, setHapticFeedback, reduceMotion, setReduceMotion,
    showHud, setShowHud, nativeWakeWord, setNativeWakeWord,
  } = useGiaStore(useShallow(s => ({
    longRunningMode: s.longRunningMode,
    setLongRunningMode: s.setLongRunningMode,
    autoModelUnload: s.autoModelUnload,
    setAutoModelUnload: s.setAutoModelUnload,
    hapticFeedback: s.hapticFeedback,
    setHapticFeedback: s.setHapticFeedback,
    reduceMotion: s.reduceMotion,
    setReduceMotion: s.setReduceMotion,
    showHud: s.showHud,
    setShowHud: s.setShowHud,
    nativeWakeWord: s.nativeWakeWord,
    setNativeWakeWord: s.setNativeWakeWord,
  })));

  const native = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('GIAWakeWord');
  const [wakeRunning, setWakeRunning] = useState(false);

  useEffect(() => {
    if (!native) return;
    let alive = true;
    const read = () => GIAWakeWord.getStatus()
      .then(s => { if (alive) setWakeRunning(s.running); })
      .catch(() => { if (alive) setWakeRunning(false); });
    void read();
    const id = setInterval(read, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [native]);

  const stopWakeWord = async () => {
    try { await GIAWakeWord.stopListening(); } catch { /* already stopped */ }
    setNativeWakeWord(false);
    setWakeRunning(false);
  };

  return (
    <div className="gia-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <BatteryCharging size={14} className="text-emerald-400" />
        <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Power & Background</span>
      </div>

      <Switch
        checked={longRunningMode}
        onChange={setLongRunningMode}
        label="Long-Running Mode"
        description="Prevents screen dimming and browser tab suspension. Use when GIA needs to run autonomously for extended periods."
        icon={<Battery size={13} />}
        accentColor="#22c55e"
      />

      {longRunningMode && (
        <div className="mt-2 pl-6">
          <Switch
            checked={autoModelUnload}
            onChange={setAutoModelUnload}
            label="Auto-Unload Idle Models"
            description="Unloads Whisper, Vision, and local LLM after 10 minutes of inactivity to free memory during long sessions."
            icon={<Moon size={13} />}
            accentColor="#a855f7"
          />
        </div>
      )}

      {longRunningMode && (
        <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
          <div className="flex items-start gap-2">
            <Cpu size={11} className="mt-0.5 shrink-0 text-emerald-400" />
            <p className="text-[9px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
              GIA will hold a screen wake lock and run a background heartbeat to prevent the browser from suspending the tab.
              On Android, the native foreground service already keeps the process alive.
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--gia-border)' }}>
        <Switch
          checked={hapticFeedback}
          onChange={setHapticFeedback}
          label="Haptic Feedback"
          description="Vibrate briefly when AI finishes responding."
          icon={<Vibrate size={13} />}
          accentColor="#a855f7"
        />
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--gia-border)' }}>
        <Switch
          checked={showHud}
          onChange={setShowHud}
          label="Floating Chat HUD"
          description="A compact chat window that stays with you across modules. It is off unless you turn it on, and it has a visible off switch."
          icon={<MessageSquare size={13} />}
          accentColor="#a855f7"
        />
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Activity size={12} style={{ color: 'var(--gia-muted)' }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Background activity</span>
        </div>

        <div className="flex items-center gap-2 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wakeRunning ? 'var(--gia-text)' : 'var(--gia-muted-2)' }} />
          <Radio size={11} style={{ color: 'var(--gia-muted)' }} />
          <span className="text-[11px] flex-1" style={{ color: 'var(--gia-text)' }}>Wake word listener</span>
          <span className="text-[9px] uppercase tracking-wider" style={{ color: wakeRunning ? 'var(--gia-text)' : 'var(--gia-muted-2)' }}>
            {wakeRunning ? 'listening' : nativeWakeWord ? 'starting' : 'off'}
          </span>
          {(wakeRunning || nativeWakeWord) && (
            <button
              onClick={() => { void stopWakeWord(); }}
              className="text-[9px] px-1.5 py-0.5 rounded tap-feedback"
              style={{ color: 'var(--gia-muted)', border: '1px solid var(--gia-border-2)' }}
            >
              Stop
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: showHud ? 'var(--gia-text)' : 'var(--gia-muted-2)' }} />
          <MessageSquare size={11} style={{ color: 'var(--gia-muted)' }} />
          <span className="text-[11px] flex-1" style={{ color: 'var(--gia-text)' }}>Floating chat HUD</span>
          <span className="text-[9px] uppercase tracking-wider" style={{ color: showHud ? 'var(--gia-text)' : 'var(--gia-muted-2)' }}>
            {showHud ? 'on screen' : 'off'}
          </span>
        </div>

        <p className="text-[9px] leading-relaxed mt-1.5" style={{ color: 'var(--gia-muted-2)' }}>
          These are the only features that keep working while you are elsewhere in the app. Wake word uses the microphone and shows a notification; the HUD uses no microphone or location.
        </p>
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--gia-border)' }}>
        <Switch
          checked={reduceMotion}
          onChange={setReduceMotion}
          label="Reduce Motion"
          description="Turns off transition and orbiting-particle animations app-wide. Chat responses still stream in normally, just without the extra motion."
          icon={<Wind size={13} />}
          accentColor="#a855f7"
        />
      </div>
    </div>
  );
};
