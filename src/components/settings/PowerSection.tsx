import React from 'react';
import { Battery, BatteryCharging, Cpu, Moon, Vibrate, Wind } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';
import { Switch } from '../ui/Switch';

export const PowerSection: React.FC = () => {
  const { longRunningMode, setLongRunningMode, autoModelUnload, setAutoModelUnload, hapticFeedback, setHapticFeedback, reduceMotion, setReduceMotion } = useGiaStore(useShallow(s => ({
    longRunningMode: s.longRunningMode,
    setLongRunningMode: s.setLongRunningMode,
    autoModelUnload: s.autoModelUnload,
    setAutoModelUnload: s.setAutoModelUnload,
    hapticFeedback: s.hapticFeedback,
    setHapticFeedback: s.setHapticFeedback,
    reduceMotion: s.reduceMotion,
    setReduceMotion: s.setReduceMotion,
  })));

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
