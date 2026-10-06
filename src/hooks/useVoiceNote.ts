import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../services/audioRecorder';
import { transcribeVoiceNote } from '../services/voiceNote';
import { levelFromTimeDomain, pushLevel } from '../utils/waveform';

export type VoiceNoteState = 'idle' | 'recording' | 'transcribing';

const MAX_MS = 5 * 60 * 1000;
export const BAR_COUNT = 32;

/**
 * WhatsApp-style voice note: start, watch the waveform and timer, then either
 * send (returns the transcript) or cancel. Releases the microphone on every exit path.
 */
export function useVoiceNote() {
  const [state, setState] = useState<VoiceNoteState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef(new AudioRecorder());
  const startedAt = useRef(0);
  const raf = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const stateRef = useRef<VoiceNoteState>('idle');
  stateRef.current = state;

  const stopMetering = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    stopMetering();
    setState('idle');
    setElapsed(0);
    setLevels([]);
    setStatus('');
  }, [stopMetering]);

  const cancel = useCallback(() => {
    recorder.current.cancel();
    reset();
  }, [reset]);

  const start = useCallback(async () => {
    if (stateRef.current !== 'idle') return;
    setError(null);
    try {
      await recorder.current.start();
    } catch {
      setError('Microphone is not available. Check the microphone permission.');
      return;
    }
    startedAt.current = Date.now();
    setState('recording');
    setLevels([]);

    const stream = recorder.current.stream;
    let analyser: AnalyserNode | null = null;
    let buf: Uint8Array<ArrayBuffer> | null = null;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (stream && Ctx) {
        const ctx = new Ctx();
        ctxRef.current = ctx;
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        buf = new Uint8Array(analyser.fftSize);
      }
    } catch { /* no waveform, the timer still works */ }

    let lastBar = 0;
    const tick = (now: number) => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (analyser && buf && now - lastBar > 60) {
        lastBar = now;
        analyser.getByteTimeDomainData(buf);
        setLevels(prev => pushLevel(prev, levelFromTimeDomain(buf as Uint8Array), BAR_COUNT));
      }
      if (ms >= MAX_MS) { setError('Voice notes are limited to 5 minutes.'); cancel(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [cancel]);

  /** Stop recording and return the transcript, or null if there was nothing to send. */
  const finish = useCallback(async (): Promise<string | null> => {
    if (stateRef.current !== 'recording') return null;
    stopMetering();
    setState('transcribing');
    setStatus('Transcribing…');
    try {
      const blob = await recorder.current.stop();
      const text = await transcribeVoiceNote(blob, setStatus);
      reset();
      return text;
    } catch (e) {
      recorder.current.cancel();
      setError(e instanceof Error ? e.message : 'Could not transcribe that.');
      reset();
      return null;
    }
  }, [reset, stopMetering]);

  // Leaving the screen must not leave the microphone open.
  useEffect(() => () => {
    recorder.current.cancel();
    cancelAnimationFrame(raf.current);
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  }, []);

  return { state, elapsed, levels, status, error, clearError: () => setError(null), start, finish, cancel };
}
