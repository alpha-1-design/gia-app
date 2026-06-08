import { useState, useRef, useCallback } from 'react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { useVoiceControl } from './useVoiceControl';
import { logger } from '../utils/logger';

export function useVoiceInput(abortTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const wakeWord = useGiaStore(s => s.wakeWord);
  const keepListening = useGiaStore(s => s.keepListening);
  const keepListeningRef = useRef(keepListening);
  keepListeningRef.current = keepListening;
  const voiceLanguage = useGiaStore(s => s.voiceLanguage);

  const playBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      osc.onended = () => ctx.close();
    } catch (e) { logger.error('[useVoiceInput] Audio beep failed:', e); }
  }, []);

  const handleWakeWord = useCallback((transcript: string) => {
    playBeep();
    const ww = useGiaStore.getState().wakeWord;
    if (!ww) return;
    const query = transcript.replace(new RegExp(ww.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').replace(/\s+/g, ' ').trim();
    if (query) {
      useGiaStore.getState().addNotification('Wake word detected');
      return query;
    }
    return '';
  }, [playBeep]);

  const handleVoiceTranscript = useCallback(async (transcript: string, setInput: (val: string) => void) => {
    if (!transcript.trim()) return;

    if (transcript.split(' ').length < 8) {
      setInput(transcript);
      return;
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    abortTimeoutRef.current = timeout;

    useGiaStore.getState().addNotification('Polishing transcript...');
    try {
      const res = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: `The following is a raw voice-to-text transcript. Please polish it for clarity, grammar, and punctuation while maintaining the original intent and tone. Return ONLY the polished text.\n\nRaw Transcript: "${transcript}"`,
        temperature: 0.3,
        maxTokens: 1000,
      });
      clearTimeout(timeout);
      if (res.text && !ctrl.signal.aborted) {
        setInput(res.text.trim());
      }
    } catch {
      clearTimeout(timeout);
      setInput(transcript);
    }
  }, [abortTimeoutRef]);

  const onWakeWord = useCallback((transcript: string) => {
    const query = handleWakeWord(transcript);
    if (query) {
      useGiaStore.getState().addNotification('Wake word detected');
    }
  }, [handleWakeWord]);

  const voiceControl = useVoiceControl({
    wakeWord,
    onWakeWord,
    onTranscript: (transcript: string) => {
      const setInput = useGiaStore.getState().setInput;
      if (setInput) handleVoiceTranscript(transcript, setInput);
    },
    keepListening,
    autoStopAfter: 120000,
    confidenceThreshold: 0.3,
    language: voiceLanguage,
  });

  const voiceRef = useRef(voiceControl);
  voiceRef.current = voiceControl;

  return {
    voiceEnabled,
    setVoiceEnabled,
    playBeep,
    handleWakeWord,
    handleVoiceTranscript,
    voiceControl,
    voiceRef,
    keepListeningRef,
    voiceLanguage,
    wakeWord,
  };
}
