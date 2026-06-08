import { logger } from '../utils/logger';
import { useEffect, useRef, useState, useCallback } from 'react';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

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
  onDirectCommand?: (command: string, raw: string) => boolean;
  autoStopAfter?: number;
  keepListening?: boolean;
  confidenceThreshold?: number;
  language?: string;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function useVoiceControl(config: VoiceControlConfig = {}) {
  const {
    wakeWord = 'hey gia',
    onWakeWord,
    onTranscript,
    autoStopAfter = 60000,
    keepListening = false,
    confidenceThreshold = 0.3,
    language = 'en-US',
  } = config;

  const [isListening, setIsListening] = useState(false);
  const [isHearing, setIsHearing] = useState(false);
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResultRef = useRef(0);
  const srRef = useRef<BrowserSpeechRecognition | null>(null);
  const isCapacitor = !!SpeechRecognitionAPI.Capacitor;
  const listeningLoopRef = useRef(false);
  const wakeWordRegexRef = useRef(new RegExp(`\\b${escapeRegex(wakeWord)}\\b`, 'i'));

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
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
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
    } catch (e) { logger.error('[useVoiceControl] Failed to stop speech recognition:', e); }
    setIsListening(false);
    setIsHearing(false);
  }, [isCapacitor]);

  const wakeWordRef = useRef(wakeWord);
  const keepListeningRef = useRef(keepListening);
  const onWakeWordRef = useRef(onWakeWord);
  const onTranscriptRef = useRef(onTranscript);
  const thresholdRef = useRef(confidenceThreshold);
  const langRef = useRef(language);
  const onDirectCommandRef = useRef(config.onDirectCommand);
  wakeWordRef.current = wakeWord;
  keepListeningRef.current = keepListening;
  onWakeWordRef.current = onWakeWord;
  onTranscriptRef.current = onTranscript;
  thresholdRef.current = confidenceThreshold;
  langRef.current = language;
  onDirectCommandRef.current = config.onDirectCommand;

  const processTranscript = useCallback((text: string, confidence?: number) => {
    if (!text || !activeRef.current) return;
    if (confidence !== undefined && confidence < thresholdRef.current) return;
    const cleaned = text.replace(/[^\w\s']/g, '').trim();
    if (cleaned.length < 2) return;
    lastResultRef.current = Date.now();
    const hasWakeWord = wakeWordRegexRef.current.test(text);
    if (hasWakeWord) {
      onWakeWordRef.current?.(text);
      if (!keepListeningRef.current) stopListening();
      return;
    }

    // Check direct commands before LLM dispatch
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
  }, [stopListening]);

  const restartBrowserRecognition = useCallback(() => {
    if (!activeRef.current || isCapacitor || listeningLoopRef.current) return;
    try {
      const SR = SpeechRecognitionAPI.SpeechRecognition || SpeechRecognitionAPI.webkitSpeechRecognition;
      if (!SR) return;
      const sr = new SR();
      sr.continuous = true;
      sr.interimResults = true;
      sr.lang = langRef.current;
      sr.onresult = (event: SpeechRecognitionEvent) => {
        if (!activeRef.current) return;
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
      sr.onerror = () => { if (activeRef.current) stopListening(); };
      sr.onend = () => {
        setIsHearing(false);
        if (activeRef.current && keepListeningRef.current) {
          timeoutRef.current = setTimeout(restartBrowserRecognition, 500);
        }
      };
      sr.start();
      srRef.current = sr;
    } catch { if (activeRef.current) stopListening(); }
  }, [isCapacitor, processTranscript, stopListening]);

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
          language: langRef.current,
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
      logger.error('Speech recognition error:', e);
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
      logger.error('Microphone permission denied');
      return;
    }

    activeRef.current = true;
    setIsListening(true);

    if (isCapacitor) {
      listenOnce();
    } else {
      restartBrowserRecognition();
    }

    if (autoStopAfter > 0 && !keepListeningRef.current) {
      timeoutRef.current = setTimeout(() => stopListening(), autoStopAfter);
    }
  }, [isCapacitor, listenOnce, restartBrowserRecognition, autoStopAfter, stopListening, requestPermissions]);

  useEffect(() => {
    return () => { activeRef.current = false; stopListening(); };
  }, [stopListening]);

  return { isListening, isHearing, startListening, stopListening, requestPermissions } as const;
}
