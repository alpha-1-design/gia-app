import { useEffect, useRef, useState, useCallback } from 'react';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export interface VoiceControlConfig {
  wakeWord?: string;
  onWakeWord?: (transcript: string) => void;
  onResult?: (text: string) => void;
  onTranscript?: (text: string) => void;
  autoStopAfter?: number;
  keepListening?: boolean;
}

export function useVoiceControl(config: VoiceControlConfig = {}) {
  const {
    wakeWord = 'hey gia',
    onWakeWord,
    onResult,
    onTranscript,
    autoStopAfter = 60000,
    keepListening = false,
  } = config;

  const [isListening, setIsListening] = useState(false);
  const [isHearing, setIsHearing] = useState(false);
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const srRef = useRef<any>(null);
  const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

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
    if (!text) return;
    onResult?.(text);
    onTranscript?.(text);
    if (text.toLowerCase().includes(wakeWord.toLowerCase())) {
      onWakeWord?.(text);
      if (!keepListening) stopListening();
    }
  }, [wakeWord, onWakeWord, onResult, onTranscript, keepListening, stopListening]);

  const listenOnce = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      if (isCapacitor) {
        const { available } = await SpeechRecognition.available();
        if (!available) {
          setIsListening(false);
          return;
        }

        const result = await SpeechRecognition.start({
          language: 'en-US',
          partialResults: true,
          popup: false,
        });

        if (result?.matches?.length) {
          processTranscript(result.matches[0]);
        }

        // Continuous listening logic for wake word
        if (activeRef.current && (keepListening || wakeWord)) {
          setTimeout(listenOnce, 300);
        } else {
          stopListening();
        }
      }
    } catch (e) {
      console.error('Speech recognition error:', e);
      if (activeRef.current && (keepListening || wakeWord)) {
        setTimeout(listenOnce, 1000);
      } else {
        stopListening();
      }
    }
  }, [isCapacitor, processTranscript, keepListening, stopListening, wakeWord]);

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

    if (autoStopAfter > 0 && !wakeWord) {
      timeoutRef.current = setTimeout(() => stopListening(), autoStopAfter);
    }
  }, [isCapacitor, listenOnce, processTranscript, autoStopAfter, stopListening, requestPermissions, wakeWord]);

  useEffect(() => {
    return () => { activeRef.current = false; stopListening(); };
  }, [stopListening]);

  return { isListening, isHearing, startListening, stopListening, requestPermissions };
}
