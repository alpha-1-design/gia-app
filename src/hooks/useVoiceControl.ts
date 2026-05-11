import { useEffect, useRef, useState, useCallback } from 'react';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export interface VoiceControlConfig {
  wakeWord?: string;
  onWakeWord?: (transcript: string) => void;
  onResult?: (text: string) => void;
  autoStopAfter?: number;
  keepListening?: boolean;
}

export function useVoiceControl(config: VoiceControlConfig = {}) {
  const {
    wakeWord = 'hey gia',
    onWakeWord,
    onResult,
    autoStopAfter = 60000,
    keepListening = false,
  } = config;

  const [isListening, setIsListening] = useState(false);
  const [isHearing, setIsHearing] = useState(false);
  const activeRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const srRef = useRef<any>(null);
  const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

  const stopListening = useCallback(async () => {
    activeRef.current = false;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = undefined; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = undefined; }
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

  const processTranscript = useCallback((text: string) => {
    onResult?.(text);
    if (text.toLowerCase().includes(wakeWord.toLowerCase())) {
      onWakeWord?.(text);
      if (!keepListening) stopListening();
    }
  }, [wakeWord, onWakeWord, onResult, keepListening, stopListening]);

  const listenOnce = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      if (isCapacitor) {
        const { available } = await SpeechRecognition.available();
        if (!available) return;
        const result = await SpeechRecognition.start({
          language: 'en-US',
          partialResults: true,
          popup: false,
        });
        if (result?.matches?.length) {
          processTranscript(result.matches[0]);
        }
      }
    } catch {}
  }, [isCapacitor, processTranscript]);

  const startListening = useCallback(async () => {
    activeRef.current = true;
    setIsListening(true);

    if (isCapacitor) {
      listenOnce();
      pollRef.current = setInterval(listenOnce, 4000);
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

    if (autoStopAfter > 0) {
      timeoutRef.current = setTimeout(() => stopListening(), autoStopAfter);
    }
  }, [isCapacitor, listenOnce, processTranscript, autoStopAfter, stopListening]);

  useEffect(() => {
    return () => { activeRef.current = false; stopListening(); };
  }, [stopListening]);

  return { isListening, isHearing, startListening, stopListening };
}
