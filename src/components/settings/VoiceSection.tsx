import React, { useState, useEffect } from 'react';
import { Headphones } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import TTSService from '../../services/TTSService';
import { LANGUAGES } from '../../config/constants';

export const VoiceSection: React.FC = () => {
  const [wakeWord, setWakeWord] = useState(() => localStorage.getItem('gia-wake-word') || 'hey gia');
  const [keepListening, setKeepListening] = useState(() => localStorage.getItem('gia-keep-listening') === 'true');
  const [autoStart, setAutoStart] = useState(() => localStorage.getItem('gia-auto-start-wake-word') === 'true');
  const [ttsEnabled, setTtsEnabled] = useState(() => TTSService.isEnabled());
  const [voiceLang, setVoiceLang] = useState(() => localStorage.getItem('gia-voice-language') || 'en-US');

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

      <label className="flex items-center gap-3 tap-feedback" style={{ cursor: 'pointer' }}>
        <div
          onClick={() => setAutoStart(k => !k)}
          className="w-8 h-4 rounded-full relative transition-all shrink-0"
          style={{ background: autoStart ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{ left: autoStart ? '18px' : '2px', background: autoStart ? '#a855f7' : 'var(--gia-muted-2)' }}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Auto-Start Wake Word</p>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            Automatically start listening for wake word when app opens.
          </p>
        </div>
      </label>

      <label className="flex items-center gap-3 tap-feedback" style={{ cursor: 'pointer' }}>
        <div
          onClick={() => setKeepListening(k => !k)}
          className="w-8 h-4 rounded-full relative transition-all shrink-0"
          style={{ background: keepListening ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{ left: keepListening ? '18px' : '2px', background: keepListening ? '#ec4899' : 'var(--gia-muted-2)' }}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Stay Listening</p>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            Keep listening for more wake words after each detection. Off = one-shot.
          </p>
        </div>
      </label>

      <label className="flex items-center gap-3 tap-feedback" style={{ cursor: 'pointer' }}>
        <div
          onClick={() => {
            const newVal = !ttsEnabled;
            setTtsEnabled(newVal);
            TTSService.setEnabled(newVal);
          }}
          className="w-8 h-4 rounded-full relative transition-all shrink-0"
          style={{ background: ttsEnabled ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{ left: ttsEnabled ? '18px' : '2px', background: ttsEnabled ? '#ec4899' : 'var(--gia-muted-2)' }}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Voice Response (TTS)</p>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            GIA will read her responses out loud.
          </p>
        </div>
      </label>
    </div>
  );
};
