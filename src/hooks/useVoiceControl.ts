import { useEffect, useRef, useState, useCallback } from 'react';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

export interface VoiceControlConfig {
  wakeWord?: string;
  onWakeWord?: (transcript: string) => void;
  onTranscript?: (text: string) => void;
  autoStopAfter?: number;
  keepListening?: boolean;
}

export function useVoiceControl(config: VoiceControlConfig = {}) {
  const {
    wakeWord = 'hey gia',
    onWakeWord,
    onTranscript,
    autoStopAfter = 60000,
    keepListening = false,
  } = config;

  const [isListening, setIsListening] = useState(false);
  const [isHearing, setIsHearing] = useState(false);
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResultRef = useRef(0);
  const srRef = useRef<any>(null);
  const isCapacitor = typeof (window as any).Capacitor !== 'undefined';
  const listeningLoopRef = useRef(false);

  const requestPermissions = useCallback(async () => {
    if (!isCapacitor) return true;
    try {
      const status = await SpeechRecognition.checkPermissions();
      if (status.speechRecognition === 'granted') return true;

      const newStatus = await SpeechRecognition.requestPermissions();
      return newStatus.speechRecognition === 'granted';
    } catch (e) {
      console.error('Permission request failed:', e);
      return false;
    }
  }, [isCapacitor]);

  const stopListening = useCallback(async () => {
    activeRef.current = false;
    listeningLoopRef.current = false;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    try {
      if (isCapacitor) {
        await SpeechRecognition.stop();
      } else if (srRef.current) {
        srRef.current.stop();
        srRef.current = undefined;
      }
    } catch {}
    setIsListening(false);
    setIsHearing(false);
  }, [isCapacitor]);

  const wakeWordRef = useRef(wakeWord);
  const keepListeningRef = useRef(keepListening);
  const onWakeWordRef = useRef(onWakeWord);
  const onTranscriptRef = useRef(onTranscript);
  wakeWordRef.current = wakeWord;
  keepListeningRef.current = keepListening;
  onWakeWordRef.current = onWakeWord;
  onTranscriptRef.current = onTranscript;

  const processTranscript = useCallback((text: string) => {
    if (!text || !activeRef.current) return;
    const cleaned = text.replace(/[^\w\s']/g, '').trim();
    if (cleaned.length < 2) return;
    lastResultRef.current = Date.now();
    onTranscriptRef.current?.(cleaned);
    const hasWakeWord = text.toLowerCase().includes(wakeWordRef.current.toLowerCase());
    if (hasWakeWord) {
      onWakeWordRef.current?.(text);
      if (!keepListeningRef.current) stopListening();
    }
  }, [stopListening]);

  const listenOnce = useCallback(async () => {
    if (!activeRef.current || listeningLoopRef.current) return;
    listeningLoopRef.current = true;
    try {
      if (isCapacitor) {
        const { available } = await SpeechRecognition.available();
        if (!activeRef.current) { listeningLoopRef.current = false; return; }
        if (!available) {
          setIsListening(false);
          listeningLoopRef.current = false;
          return;
        }

        const result = await SpeechRecognition.start({
          language: 'en-US',
          partialResults: true,
          popup: false,
        });

        if (!activeRef.current) { listeningLoopRef.current = false; return; }

        const hadResult = result?.matches?.length && result.matches[0]?.length > 0;
        if (hadResult) {
          processTranscript(result.matches![0]);
        }

        if (!activeRef.current) { listeningLoopRef.current = false; return; }

        const backoff = hadResult ? 1500 : 3000;
        listeningLoopRef.current = false;

        if (keepListeningRef.current) {
          timeoutRef.current = setTimeout(listenOnce, backoff);
        } else {
          stopListening();
        }
      }
    } catch (e) {
      console.error('Speech recognition error:', e);
      listeningLoopRef.current = false;
      if (activeRef.current && keepListeningRef.current) {
        timeoutRef.current = setTimeout(listenOnce, 3000);
      } else {
        stopListening();
      }
    }
  }, [isCapacitor, processTranscript, stopListening]);

  const startListening = useCallback(async () => {
    if (activeRef.current) return;

    const granted = await requestPermissions();
    if (!granted) {
      console.error('Microphone permission denied');
      return;
    }

    activeRef.current = true;
    setIsListening(true);

    if (isCapacitor) {
      listenOnce();
    } else {
      try {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const sr = new SR();
        sr.continuous = true;
        sr.interimResults = true;
        sr.lang = 'en-US';
        sr.onresult = (event: any) => {
          if (!activeRef.current) return;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            setIsHearing(true);
            if (event.results[i].isFinal) {
              setIsHearing(false);
              processTranscript(text);
            }
          }
        };
        sr.onerror = () => { if (activeRef.current) stopListening(); };
        sr.start();
        srRef.current = sr;
      } catch { stopListening(); }
    }

    if (autoStopAfter > 0 && !keepListeningRef.current) {
      timeoutRef.current = setTimeout(() => stopListening(), autoStopAfter);
    }
  }, [isCapacitor, listenOnce, processTranscript, autoStopAfter, stopListening, requestPermissions]);

  useEffect(() => {
    return () => { activeRef.current = false; stopListening(); };
  }, [stopListening]);

  return { isListening, isHearing, startListening, stopListening, requestPermissions };
}
