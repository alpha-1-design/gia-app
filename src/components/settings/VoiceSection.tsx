import React, { useState, useEffect } from 'react';
import { Headphones, Radio } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import TTSService from '../../services/TTSService';
import { LANGUAGES } from '../../config/constants';
import { Switch } from '../ui/Switch';

export const VoiceSection: React.FC = () => {
  const [wakeWord, setWakeWord] = useState(() => localStorage.getItem('gia-wake-word') || 'hey gia');
  const [keepListening, setKeepListening] = useState(() => localStorage.getItem('gia-keep-listening') === 'true');
  const [autoStart, setAutoStart] = useState(() => localStorage.getItem('gia-auto-start-wake-word') === 'true');
  const [ttsEnabled, setTtsEnabled] = useState(() => TTSService.isEnabled());
  const [voiceLang, setVoiceLang] = useState(() => localStorage.getItem('gia-voice-language') || 'en-US');
  const [nativeWW, setNativeWW] = useState(() => localStorage.getItem('gia-native-wake-word') !== 'false');
  const [sensitivity, setSensitivity] = useState(() => parseFloat(localStorage.getItem('gia-native-sensitivity') || '0.7'));

  useEffect(() => {
    localStorage.setItem('gia-wake-word', wakeWord);
    useGiaStore.getState().setWakeWord(wakeWord);
  }, [wakeWord]);

  useEffect(() => {
    localStorage.setItem('gia-keep-listening', String(keepListening));
  }, [keepListening]);

  useEffect(() => {
    localStorage.setItem('gia-auto-start-wake-word', String(autoStart));
    useGiaStore.getState().setAutoStartWakeWord(autoStart);
  }, [autoStart]);

  useEffect(() => {
    localStorage.setItem('gia-voice-language', voiceLang);
    useGiaStore.getState().setVoiceLanguage(voiceLang);
  }, [voiceLang]);

  useEffect(() => {
    localStorage.setItem('gia-native-wake-word', String(nativeWW));
    useGiaStore.getState().setNativeWakeWord(nativeWW);
  }, [nativeWW]);

  useEffect(() => {
    localStorage.setItem('gia-native-sensitivity', String(sensitivity));
    useGiaStore.getState().setNativeSensitivity(sensitivity);
  }, [sensitivity]);

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="flex items-center gap-2">
        <Headphones size={14} style={{ color: '#ec4899' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Voice Control
        </span>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
          Wake Word
        </label>
        <div className="flex gap-2">
          <input
            className="gia-input"
            value={wakeWord}
            onChange={e => setWakeWord(e.target.value)}
            placeholder="hey gia"
            style={{ fontSize: '12px', flex: 1 }}
          />
        </div>
        <p className="text-[9px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
          Say this phrase to activate voice input. Tap "Listen" in Chat to enable.
        </p>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
          Recognition Language
        </label>
        <select
          className="gia-input"
          value={voiceLang}
          onChange={e => setVoiceLang(e.target.value)}
          style={{ fontSize: '12px', width: '100%' }}
        >
          {LANGUAGES.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      <Switch
        checked={nativeWW}
        onChange={setNativeWW}
        icon={<Radio size={11} />}
        label="Background Wake Word"
        description="Uses native wake word engine (Porcupine). Works when app is in background."
        accentColor="#a855f7"
      />

      {nativeWW && (
        <div>
          <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
            Sensitivity: {sensitivity.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sensitivity}
            onChange={e => setSensitivity(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#a855f7' }}
          />
          <div className="flex justify-between text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
            <span>Fewer detections</span>
            <span>More detections</span>
          </div>
        </div>
      )}

      <Switch
        checked={autoStart}
        onChange={setAutoStart}
        label="Auto-Start Wake Word"
        description="Automatically start listening for wake word when app opens."
        accentColor="#a855f7"
      />

      <Switch
        checked={keepListening}
        onChange={setKeepListening}
        label="Stay Listening"
        description="Keep listening for more wake words after each detection. Off = one-shot."
        accentColor="#ec4899"
      />

      <Switch
        checked={ttsEnabled}
        onChange={v => { setTtsEnabled(v); TTSService.setEnabled(v); }}
        label="Voice Response (TTS)"
        description="GIA will read her responses out loud."
        accentColor="#ec4899"
      />
    </div>
  );
};