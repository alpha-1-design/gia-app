import { logger } from '../utils/logger';
import { isNativePlatform } from '../utils/helpers';
import ttsService from '../services/TTSService';
import { useEffect, useRef, useState, useCallback } from 'react';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import type { SpeechRecognitionPartialResultEvent, SpeechRecognitionListeningEvent } from '@capgo/capacitor-speech-recognition';
import { Capacitor } from '@capacitor/core';

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResult[];
}

interface CapacitorGlobal {
  Capacitor?: { isPluginAvailable?: (name: string) => boolean };
}

const SpeechRecognitionAPI = (globalThis as unknown as CapacitorGlobal & { SpeechRecognition?: new () => BrowserSpeechRecognition; webkitSpeechRecognition?: new () => BrowserSpeechRecognition });

const DIRECT_COMMANDS: [RegExp, string][] = [
  [/^(scroll|go)\s*(up|down)/i, 'scroll_$2'],
  [/^scroll\s*(to\s*)?(top|bottom)/i, 'scroll_$2'],
  [/^(go\s*)?back/i, 'navigate_back'],
  [/^open\s+(settings|chat|exam|analyst|writer|planner)/i, 'open_$1'],
  [/^(show|hide)\s+(console|terminal|logs)/i, 'toggle_$1_console'],
  [/^(clear|reset)\s+(chat|conversation)/i, 'clear_chat'],
  [/^(stop|pause)\s*(speaking|talking|audio)/i, 'stop_tts'],
  [/^(help|commands|what can you do)/i, 'show_help'],
  [/^(save|remember)\s+(this|that)/i, 'save_memory'],
  [/^what (did|do) (i|we) (say|talk about)/i, 'recall_recent'],
  [/^switch\s+(to\s+)?(chat|exam|analyst|writer|planner|settings)/i, 'switch_$2'],
];

export interface VoiceControlConfig {
  wakeWord?: string;
  onWakeWord?: (transcript: string) => void;
  onTranscript?: (text: string) => void;
  onInterim?: (text: string) => void;
  onDirectCommand?: (command: string, raw: string) => boolean;
  autoStopAfter?: number;
  keepListening?: boolean;
  confidenceThreshold?: number;
  language?: string;
  nativeWakeWord?: boolean;
  nativeSensitivity?: number;
  wakeWordAccessKey?: string;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}  // Maps the user's configured phrase to the closest supported keyword for the
  // on-device engine. The native service detects its bundled keyword set
  // (HEY JARVIS / HEY GIA / ...) and reports back the readable label; this
  // value is only used as a fallback label and for the web recognizer.
  function mapWakeWordToBuiltin(wakeWord: string): string {
    const w = wakeWord.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const known: Record<string, string> = {
      'hey_google': 'HEY_GOOGLE',
      'ok_google': 'OK_GOOGLE',
      'hey_siri': 'HEY_SIRI',
      'alexa': 'ALEXA',
      'computer': 'COMPUTER',
      'jarvis': 'JARVIS',
      'hey_jarvis': 'JARVIS',
      'picovoice': 'PICOVOICE',
      'porcupine': 'PORCUPINE',
      'hey_gia': 'JARVIS',
      'gia': 'JARVIS',
    };
    return known[w] || 'JARVIS';
  }

export function useVoiceControl(config: VoiceControlConfig = {}) {
  const {
    wakeWord = 'hey gia',
    onWakeWord,
    onTranscript,
    onInterim,
    autoStopAfter = 60000,
    keepListening = false,
    confidenceThreshold = 0.3,
    language = 'en-US',
    nativeWakeWord = true,
    nativeSensitivity = 0.7,
    wakeWordAccessKey = '',
  } = config;

  const [isListening, setIsListening] = useState(false);
  const [isHearing, setIsHearing] = useState(false);
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResultRef = useRef(0);
  const srRef = useRef<BrowserSpeechRecognition | null>(null);
  const isCapacitor = isNativePlatform() && !!SpeechRecognitionAPI.Capacitor;
  const isNative = isCapacitor && (typeof Capacitor !== 'undefined' && typeof Capacitor?.isPluginAvailable === 'function' ? Capacitor.isPluginAvailable('GIAWakeWord') : false);
  const listeningLoopRef = useRef(false);
  const wakeWordRegexRef = useRef(new RegExp(`\\b${escapeRegex(wakeWord)}\\b`, 'i'));
  const nativeListenerRef = useRef<{ remove: () => void } | null>(null);
  const restartCountRef = useRef(0);
  const listenOnceCountRef = useRef(0);
  const partialListenerRef = useRef<{ remove: () => void } | null>(null);
  const stateListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    wakeWordRegexRef.current = new RegExp(`\\b${escapeRegex(wakeWord)}\\b`, 'i');
  }, [wakeWord]);

  const requestPermissions = useCallback(async () => {
    if (!isCapacitor) return true;
    try {
      const status = await SpeechRecognition.checkPermissions();
      if (status.speechRecognition === 'granted') return true;
      const newStatus = await SpeechRecognition.requestPermissions();
      return newStatus.speechRecognition === 'granted';
    } catch (e) {
      logger.error('Permission request failed:', e);
      return false;
    }
  }, [isCapacitor]);

  const stopListening = useCallback(async () => {
    activeRef.current = false;
    listeningLoopRef.current = false;
    restartCountRef.current = 0;
    listenOnceCountRef.current = 0;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

    if (nativeListenerRef.current) {
      try { nativeListenerRef.current.remove(); } catch { /* ignore */ }
      nativeListenerRef.current = null;
    }

    if (partialListenerRef.current) {
      try { partialListenerRef.current.remove(); } catch { /* ignore */ }
      partialListenerRef.current = null;
    }
    if (stateListenerRef.current) {
      try { stateListenerRef.current.remove(); } catch { /* ignore */ }
      stateListenerRef.current = null;
    }

    if (isNative) {
      try {
        const { GIAWakeWord } = await import('../services/GIAWakeWord');
        await GIAWakeWord.stopListening();
      } catch { /* ignore */ }
    }

    try {
      if (isCapacitor) {
        await SpeechRecognition.stop();
      } else if (srRef.current) {
        srRef.current.stop();
        srRef.current.onresult = null;
        srRef.current.onerror = null;
        srRef.current.onend = null;
        srRef.current = null;
      }
    } catch { /* ignore if speech recognition was not active or unimplemented on web */ }
    setIsListening(false);
    setIsHearing(false);
  }, [isCapacitor, isNative]);

  const wakeWordRef = useRef(wakeWord);
  const keepListeningRef = useRef(keepListening);
  const onWakeWordRef = useRef(onWakeWord);
  const onTranscriptRef = useRef(onTranscript);
  const onInterimRef = useRef(onInterim);
  const thresholdRef = useRef(confidenceThreshold);
  const langRef = useRef(language);
  const onDirectCommandRef = useRef(config.onDirectCommand);
  const accessKeyRef = useRef(wakeWordAccessKey);
  wakeWordRef.current = wakeWord;
  keepListeningRef.current = keepListening;
  onWakeWordRef.current = onWakeWord;
  onTranscriptRef.current = onTranscript;
  onInterimRef.current = onInterim;
  thresholdRef.current = confidenceThreshold;
  langRef.current = language;
  onDirectCommandRef.current = config.onDirectCommand;
  accessKeyRef.current = wakeWordAccessKey;

  const captureQueryAfterWake = useCallback(async () => {
    if (!activeRef.current) return;
    setIsHearing(true);

    try {
      if (isCapacitor) {
        const { available } = await SpeechRecognition.available();
        if (!available || !activeRef.current) { setIsHearing(false); return; }

        const result = await SpeechRecognition.start({
          language: langRef.current,
          partialResults: false,
          popup: false,
        });

        setIsHearing(false);

        if (activeRef.current && result?.matches?.length && result.matches[0]?.length > 0) {
          const transcript = result.matches[0].replace(/[^\w\s']/g, '').trim();
          if (transcript.length >= 2) {
            onTranscriptRef.current?.(transcript);
          }
        }

        if (activeRef.current && keepListeningRef.current) {
          timeoutRef.current = setTimeout(captureQueryAfterWake, 1500);
        }
      } else {
        const SR = SpeechRecognitionAPI.SpeechRecognition || SpeechRecognitionAPI.webkitSpeechRecognition;
        if (!SR) { setIsHearing(false); return; }
        const sr = new SR();
        sr.continuous = false;
        sr.interimResults = false;
        sr.lang = langRef.current;
        sr.onresult = (event: SpeechRecognitionEvent) => {
          setIsHearing(false);
          const text = event.results[0]?.[0]?.transcript;
          if (text && activeRef.current) {
            const cleaned = text.replace(/[^\w\s']/g, '').trim();
            if (cleaned.length >= 2) onTranscriptRef.current?.(cleaned);
          }
        };
        sr.onerror = () => setIsHearing(false);
        sr.onend = () => setIsHearing(false);
        sr.start();
        srRef.current = sr;

        if (keepListeningRef.current) {
          timeoutRef.current = setTimeout(captureQueryAfterWake, 10000);
        }
      }
    } catch (e) {
      setIsHearing(false);
      logger.error('Query capture error:', e);
    }
  }, [isCapacitor]);

  const processTranscript = useCallback((text: string, confidence?: number) => {
    if (!text || !activeRef.current) return;
    if (ttsService.isSpeaking()) return;
    if (confidence !== undefined && confidence < thresholdRef.current) return;
    const cleaned = text.replace(/[^\w\s']/g, '').trim();
    if (cleaned.length < 2) return;
    lastResultRef.current = Date.now();
    const hasWakeWord = wakeWordRegexRef.current.test(text);
    if (hasWakeWord) {
      onWakeWordRef.current?.(text);
      captureQueryAfterWake();
      if (!keepListeningRef.current) stopListening();
      return;
    }

    const onDirectCommand = onDirectCommandRef.current;
    if (onDirectCommand) {
      for (const [re, cmd] of DIRECT_COMMANDS) {
        const match = cleaned.match(re);
        if (match) {
          const resolved = cmd.replace(/\$(\d+)/g, (_, i) => match[parseInt(i)] || '');
          const handled = onDirectCommand(resolved, cleaned);
          if (handled) return;
        }
      }
    }

    onTranscriptRef.current?.(cleaned);
  }, [stopListening, captureQueryAfterWake]);

  const restartBrowserRecognition = useCallback(() => {
    if (!activeRef.current || isCapacitor || listeningLoopRef.current) return;
    if (restartCountRef.current > 8) { stopListening(); return; }
    restartCountRef.current++;
    try {
      const SR = SpeechRecognitionAPI.SpeechRecognition || SpeechRecognitionAPI.webkitSpeechRecognition;
      if (!SR) return;
      const sr = new SR();
      sr.continuous = true;
      sr.interimResults = true;
      sr.lang = langRef.current;
      sr.onresult = (event: SpeechRecognitionEvent) => {
        if (!activeRef.current) return;
        restartCountRef.current = 0;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          const confidence = result[0].confidence;
          setIsHearing(true);
          if (result.isFinal) {
            setIsHearing(false);
            processTranscript(text, confidence);
          }
        }
      };
      sr.onerror = (event) => {
        if (!activeRef.current) return;
        const err = event as { error?: string };
        if (err?.error === 'no-speech' || err?.error === 'aborted') {
          timeoutRef.current = setTimeout(restartBrowserRecognition, 300);
        } else {
          stopListening();
        }
      };
      sr.onend = () => {
        setIsHearing(false);
        if (activeRef.current) {
          const delay = Math.min(500 * Math.pow(2, restartCountRef.current), 30000);
          timeoutRef.current = setTimeout(restartBrowserRecognition, delay);
        }
      };
      sr.start();
      srRef.current = sr;
    } catch { if (activeRef.current) stopListening(); }
  }, [isCapacitor, processTranscript, stopListening]);

  const listenOnce = useCallback(async () => {
    if (!activeRef.current || listeningLoopRef.current) return;
    listenOnceCountRef.current++;
    if (listenOnceCountRef.current > 20) {
      logger.warn('[useVoiceControl] Microphone timed out');
      stopListening();
      return;
    }
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

        // Live, word-for-word transcription: partialResults:true makes start()
        // resolve immediately and stream interim text through the `partialResults`
        // listener. The final utterance is delivered when `listeningState` reports
        // `stopped` (silence / results). We keep the previous `partialResults:false`
        // note as a warning: without subscribing to these listeners, start() resolves
        // empty and no speech is ever captured.
        if (partialListenerRef.current) { try { partialListenerRef.current.remove(); } catch { /* ignore */ } partialListenerRef.current = null; }
        if (stateListenerRef.current) { try { stateListenerRef.current.remove(); } catch { /* ignore */ } stateListenerRef.current = null; }

        let lastText = '';
        let committed = false;

        partialListenerRef.current = await SpeechRecognition.addListener('partialResults', (data: SpeechRecognitionPartialResultEvent) => {
          if (!activeRef.current) return;
          const text = data.accumulatedText || (data.matches && data.matches[data.matches.length - 1]) || '';
          if (text) {
            lastText = text;
            restartCountRef.current = 0;
            setIsHearing(true);
            onInterimRef.current?.(text);
          }
        });

        stateListenerRef.current = await SpeechRecognition.addListener('listeningState', (ev: SpeechRecognitionListeningEvent) => {
          if (!activeRef.current) return;
          if (ev.state === 'started' || ev.status === 'started') {
            setIsListening(true);
            setIsHearing(false);
            return;
          }
          if (ev.state === 'stopped' || ev.status === 'stopped') {
            setIsHearing(false);
            if (!committed && lastText) {
              committed = true;
              listenOnceCountRef.current = 0;
              processTranscript(lastText);
            }
            if (!activeRef.current) return;
            listeningLoopRef.current = false;
            const backoff = lastText ? 1500 : 3000;
            timeoutRef.current = setTimeout(listenOnce, backoff);
          }
        });

        const result = await SpeechRecognition.start({
          language: langRef.current,
          partialResults: true,
          popup: false,
        });

        // Some plugin versions still resolve start() with the final matches; commit
        // those if the listeningState path hasn't already.
        const hadResult = result?.matches?.length && result.matches[0]?.length > 0;
        if (hadResult && !committed) {
          committed = true;
          lastText = result.matches![0];
          onInterimRef.current?.(lastText);
          listenOnceCountRef.current = 0;
          processTranscript(lastText);
        }

        if (!activeRef.current) { listeningLoopRef.current = false; return; }
      } else {
        const SR = SpeechRecognitionAPI.SpeechRecognition || SpeechRecognitionAPI.webkitSpeechRecognition;
        if (!SR) { setIsHearing(false); listeningLoopRef.current = false; return; }
        const sr = new SR();
        sr.continuous = false;
        sr.interimResults = true;
        sr.lang = langRef.current;
        let finalText = '';
        sr.onresult = (event: SpeechRecognitionEvent) => {
          if (!activeRef.current) return;
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            let t = res[0]?.transcript ?? '';
            t = t.replace(/[^\w\s']/g, '').trim();
            if (res.isFinal) finalText += (finalText ? ' ' : '') + t;
            else interim += (interim ? ' ' : '') + t;
          }
          if (interim) {
            setIsHearing(true);
            onInterimRef.current?.(interim);
          }
          if (finalText) {
            setIsHearing(false);
            listenOnceCountRef.current = 0;
            processTranscript(finalText);
          }
        };
        sr.onerror = () => { setIsHearing(false); };
        sr.onend = () => {
          setIsHearing(false);
          if (!activeRef.current) return;
          listeningLoopRef.current = false;
          const backoff = finalText ? 1500 : 3000;
          timeoutRef.current = setTimeout(listenOnce, backoff);
        };
        sr.start();
        srRef.current = sr;
      }
    } catch (e) {
      logger.error('Speech recognition error:', e);
      listeningLoopRef.current = false;
      if (activeRef.current) {
        timeoutRef.current = setTimeout(listenOnce, 3000);
      } else {
        stopListening();
      }
    }
  }, [isCapacitor, processTranscript, stopListening]);

  const startNativeWakeWord = useCallback(async () => {
    if (!activeRef.current || !isNative) return;
    try {
      const { GIAWakeWord } = await import('../services/GIAWakeWord');
      const nativeKeyword = mapWakeWordToBuiltin(wakeWordRef.current);

      await GIAWakeWord.startListening({
        keyword: nativeKeyword,
        sensitivity: nativeSensitivity,
        accessKey: accessKeyRef.current || undefined,
      });

      const handle = await GIAWakeWord.addListener('wakeWordDetected', async ({ keyword: kw }) => {
        if (!activeRef.current) return;
        onWakeWordRef.current?.(kw || nativeKeyword);
        captureQueryAfterWake();
        if (!keepListeningRef.current) {
          setTimeout(() => stopListening(), 500);
        }
      });
      nativeListenerRef.current = handle;

      setIsListening(true);
    } catch (e) {
      logger.error('[useVoiceControl] Native wake word start failed, falling back:', e);
      if (isCapacitor) {
        listenOnce();
      } else {
        restartBrowserRecognition();
      }
    }
  }, [isNative, nativeSensitivity, listenOnce, restartBrowserRecognition, stopListening, isCapacitor, captureQueryAfterWake]);

  const startListening = useCallback(async (manual?: boolean) => {
    if (activeRef.current) return;

    const granted = await requestPermissions();
    if (!granted) {
      logger.error('Microphone permission denied');
      return;
    }

    activeRef.current = true;

    // Native wake word uses the bundled sherpa-onnx engine (fully on-device,
    // no API key needed). Only fall back to the browser recognizer when the
    // native plugin is unavailable or disabled.
    const canUseNative = isNative && nativeWakeWord;
    if (manual || !canUseNative) {
      if (isCapacitor) {
        setIsListening(true);
        listenOnce();
      } else {
        setIsListening(true);
        restartBrowserRecognition();
      }
    } else {
      await startNativeWakeWord();
      if (!activeRef.current) return;
    }

    if (autoStopAfter > 0 && !isNative) {
      timeoutRef.current = setTimeout(() => stopListening(), autoStopAfter);
    }
  }, [isNative, nativeWakeWord, startNativeWakeWord, isCapacitor, listenOnce, restartBrowserRecognition, autoStopAfter, stopListening, requestPermissions]);

  useEffect(() => {
    return () => { activeRef.current = false; stopListening(); };
  }, [stopListening]);

  return { isListening, isHearing, startListening, stopListening, requestPermissions } as const;
}
