import { useState, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { useVoiceControl } from './useVoiceControl';
import { logger } from '../utils/logger';

const BATCH_SEPARATORS = [
  /\s+(then|and( then)?|after that|followed by|next|also)\s+/gi,
  /\.\s+(then|after that|next)\s+/gi,
];

function parseBatchIntents(transcript: string): string[] {
  const trimmed = transcript.trim().replace(/[.!]+$/, '');
  const candidates = [trimmed];
  for (const sep of BATCH_SEPARATORS) {
    const parts = trimmed.split(sep).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      candidates.push(...parts);
    }
  }
  const unique = [...new Set(candidates.map(s => s.toLowerCase()))];
  if (unique.length <= 2 && candidates.length <= 2) {
    // Single intent
    return [trimmed];
  }
  // Deduplicate near-duplicates
  const result: string[] = [];
  for (const c of candidates) {
    const cLower = c.toLowerCase();
    if (!result.some(r => r.toLowerCase().includes(cLower) || cLower.includes(r.toLowerCase()))) {
      result.push(c);
    }
  }
  return result.length > 1 ? result : [trimmed];
}

export function useVoiceInput(
  abortTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  onAutoSend?: (text: string) => void,
) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const voiceSettings = useGiaStore(useShallow(s => ({
    wakeWord: s.wakeWord,
    keepListening: s.keepListening,
    voiceLanguage: s.voiceLanguage,
    nativeWakeWord: s.nativeWakeWord,
    nativeSensitivity: s.nativeSensitivity,
    wakeWordAccessKey: s.wakeWordAccessKey,
  })));
  const keepListeningRef = useRef(voiceSettings.keepListening);
  keepListeningRef.current = voiceSettings.keepListening;

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

  const handleVoiceTranscript = useCallback(async (transcript: string, setInput: (val: string) => void, handleSend?: (text: string) => void) => {
    if (!transcript.trim()) return;

    const intents = parseBatchIntents(transcript);

    if (intents.length > 1) {
      useGiaStore.getState().addNotification(`Batch: ${intents.length} intents detected`);
      for (const intent of intents) {
        let finalText: string;
        if (intent.split(' ').length < 8) {
          finalText = intent;
          setInput(finalText);
        } else {
          const ctrl = new AbortController();
          const timeout = setTimeout(() => ctrl.abort(), 5000);
          abortTimeoutRef.current = timeout;
          try {
            const res = await GiaBrain.generate({
              signal: ctrl.signal,
              prompt: `The following is a raw voice-to-text transcript. Please polish it for clarity, grammar, and punctuation while maintaining the original intent and tone. Return ONLY the polished text.\n\nRaw Transcript: "${intent}"`,
              temperature: 0.3,
              maxTokens: 1000,
            });
            clearTimeout(timeout);
            finalText = (res.text && !ctrl.signal.aborted) ? res.text.trim() : intent;
          } catch {
            clearTimeout(timeout);
            finalText = intent;
          }
          setInput(finalText);
        }
        await new Promise(r => setTimeout(r, 300));
        if (handleSend) handleSend(finalText);
      }
      return;
    }

    let finalText: string;
    if (transcript.split(' ').length < 8) {
      finalText = transcript;
      setInput(finalText);
      if (handleSend) handleSend(finalText);
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
      finalText = (res.text && !ctrl.signal.aborted) ? res.text.trim() : transcript;
    } catch {
      clearTimeout(timeout);
      finalText = transcript;
    }
    setInput(finalText);
    if (handleSend) handleSend(finalText);
  }, [abortTimeoutRef]);

  const onWakeWord = useCallback((transcript: string) => {
    handleWakeWord(transcript);
  }, [handleWakeWord]);

  const voiceControl = useVoiceControl({
    wakeWord: voiceSettings.wakeWord,
    onWakeWord,
    onTranscript: (transcript: string) => {
      const setInput = (useGiaStore.getState() as unknown as Record<string, unknown>).setInput as ((v: string) => void) | undefined;
      if (setInput) handleVoiceTranscript(transcript, setInput, (text) => onAutoSend?.(text));
    },
    keepListening: voiceSettings.keepListening,
    autoStopAfter: 120000,
    confidenceThreshold: 0.3,
    language: voiceSettings.voiceLanguage,
    nativeWakeWord: voiceSettings.nativeWakeWord,
    nativeSensitivity: voiceSettings.nativeSensitivity,
    wakeWordAccessKey: voiceSettings.wakeWordAccessKey,
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
    voiceLanguage: voiceSettings.voiceLanguage,
    wakeWord: voiceSettings.wakeWord,
  };
}
