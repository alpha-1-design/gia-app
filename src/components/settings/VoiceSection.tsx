import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Headphones, Radio, Mic, MicOff, Activity, Play, Square, AlertTriangle, Download, Cloud } from 'lucide-react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useGiaStore } from '../../store/useGiaStore';
import TTSService from '../../services/TTSService';
import WhisperService from '../../services/WhisperService';
import { getCloudSTTConfig, saveCloudSTTConfig, type CloudSTTConfig } from '../../services/CloudSTT';
import { LANGUAGES } from '../../config/constants';
import { Switch } from '../ui/Switch';
import { GIAWakeWord, type WakeWordKeyword } from '../../services/GIAWakeWord';
import { thresholdForSensitivity } from '../../utils/wakeWord';

// ── Diagnostics types ──────────────────────────────────────────────
interface DetectionEvent {
  id: number;
  timestamp: number;
  text: string;
  confidence: number;
  simulated?: boolean;
}

interface ServiceStatus {
  running: boolean;
  micPermission: boolean | null;
  modelLoaded: boolean;
  error?: string;
}

export const VoiceSection: React.FC = () => {
  const [wakeWord, setWakeWord] = useState(() => localStorage.getItem('gia-wake-word') || 'hey gia');
  const [keepListening, setKeepListening] = useState(() => localStorage.getItem('gia-keep-listening') === 'true');
  const [autoStart, setAutoStart] = useState(() => localStorage.getItem('gia-auto-start-wake-word') === 'true');
  const [ttsEnabled, setTtsEnabled] = useState(() => TTSService.isEnabled());
  const [modelVoiceEnabled, setModelVoiceEnabled] = useState(() => TTSService.isModelVoiceEnabled());
  const [voiceLang, setVoiceLang] = useState(() => localStorage.getItem('gia-voice-language') || 'en-US');
  const [nativeWW, setNativeWW] = useState(() => localStorage.getItem('gia-native-wake-word') === 'true');
  const [sensitivity, setSensitivity] = useState(() => parseFloat(localStorage.getItem('gia-native-sensitivity') || '0.7'));
  const [useWhisper, setUseWhisper] = useState(() => localStorage.getItem('gia-use-whisper') === 'true');
  const [whisperStatus, setWhisperStatus] = useState(WhisperService.status);
  const [whisperLoading, setWhisperLoading] = useState(false);
  const [cloudStt, setCloudStt] = useState<CloudSTTConfig>(() => getCloudSTTConfig());

  // ── Diagnostics state ──────────────────────────────────────────────
  const hasNativeModule = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('GIAWakeWord');
  const nativeKeyword = useGiaStore(st => st.nativeWakeKeyword);
  const reduceMotion = useGiaStore(st => st.reduceMotion);
  const [keywords, setKeywords] = useState<WakeWordKeyword[]>([]);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    running: false,
    micPermission: null,
    modelLoaded: false,
  });
  const [testing, setTesting] = useState(false);
  const [liveScore, setLiveScore] = useState(0);
  const [detectionLog, setDetectionLog] = useState<DetectionEvent[]>([]);
  const didRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const testHandlesRef = useRef<PluginListenerHandle[]>([]);
  const testingRef = useRef(false);
  const threshold = thresholdForSensitivity(sensitivity);
  const activeKeyword = keywords.find(k => k.id === nativeKeyword) ?? keywords[0];

  const checkService = useCallback(async () => {
    if (!hasNativeModule) {
      setServiceStatus({
        running: false,
        micPermission: null,
        modelLoaded: false,
        error: 'On-device wake word runs in the Android app only.',
      });
      return;
    }
    try {
      const status = await GIAWakeWord.getStatus();
      setServiceStatus({
        running: status.running,
        micPermission: status.micPermission,
        modelLoaded: status.running && status.keyword !== '',
        error: status.error || undefined,
      });
    } catch {
      setServiceStatus(prev => ({ ...prev, error: 'Could not read wake word status' }));
    }
  }, [hasNativeModule]);

  useEffect(() => {
    if (!hasNativeModule) return;
    GIAWakeWord.listKeywords().then(r => setKeywords(r.keywords)).catch(() => setKeywords([]));
  }, [hasNativeModule]);

  const logLine = useCallback((text: string, confidence: number) => {
    setDetectionLog(prev => [...prev.slice(-49), { id: didRef.current++, timestamp: Date.now(), text, confidence }]);
  }, []);

  const stopTest = useCallback(async () => {
    testHandlesRef.current.forEach(h => { void h.remove(); });
    testHandlesRef.current = [];
    testingRef.current = false;
    setTesting(false);
    setLiveScore(0);
    try { await GIAWakeWord.stopListening(); } catch { /* service already gone */ }
    void checkService();
  }, [checkService]);

  const testWakeWord = useCallback(async () => {
    if (testingRef.current) { await stopTest(); return; }
    setDetectionLog([]);
    setLiveScore(0);
    try {
      testHandlesRef.current = [
        await GIAWakeWord.addListener('wakeWordScore', ({ score }) => setLiveScore(score)),
        await GIAWakeWord.addListener('wakeWordDetected', ({ keyword, score }) => {
          logLine(keyword, score ?? 0);
          // The service releases the mic after a detection; keep the test running.
          void GIAWakeWord.resume();
        }),
        await GIAWakeWord.addListener('wakeWordError', ({ error }) => {
          logLine(`Error: ${error}`, 0);
          void stopTest();
        }),
      ];
      await GIAWakeWord.startListening({
        keyword: nativeKeyword || wakeWord,
        sensitivity,
        emitScores: true,
      });
      testingRef.current = true;
      setTesting(true);
      void checkService();
    } catch (e) {
      logLine(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, 0);
      await stopTest();
    }
  }, [nativeKeyword, wakeWord, sensitivity, checkService, logLine, stopTest]);

  // Leaving the screen mid-test must not leave the microphone open.
  useEffect(() => () => {
    testHandlesRef.current.forEach(h => { void h.remove(); });
    if (testingRef.current) void GIAWakeWord.stopListening().catch(() => undefined);
  }, []);

  // Explicit, separate action — never triggered by the real "Test" button.
  // Every event it produces is tagged `simulated: true` so the log can never
  // be mistaken for a genuine wake-word detection.
  const previewSimulatedLog = useCallback(async () => {
    setTesting(true);
    setDetectionLog([]);
    const simPatterns = ['JARVIS', 'HEY GIA', 'ALEXA', 'OK GOOGLE'];
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 800));
      const e: DetectionEvent = {
        id: didRef.current++,
        timestamp: Date.now(),
        text: simPatterns[Math.floor(Math.random() * simPatterns.length)],
        confidence: 0.5 + Math.random() * 0.5,
        simulated: true,
      };
      setDetectionLog(prev => [...prev.slice(-49), e]);
    }
    setTesting(false);
  }, []);

  useEffect(() => { checkService(); }, [checkService]);
  useEffect(() => { if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [detectionLog]);

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
          Phrase for the speech-recognition mode. Tap "Listen" in Chat to start. Background Wake Word below uses its own on-device phrase.
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
        disabled={!hasNativeModule}
        icon={<Radio size={11} />}
        label="Background Wake Word"
        description={hasNativeModule
          ? 'Listens on this device, even with the screen off. No audio leaves the phone and no account key is needed. Holds the microphone and shows a notification while on.'
          : 'Runs in the Android app only.'}
        accentColor="#a855f7"
      />

      {nativeWW && hasNativeModule && (
        <>
          <div>
            <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
              Wake phrase
            </label>
            {keywords.length > 1 ? (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Wake phrase">
                {keywords.map(k => (
                  <button
                    key={k.id}
                    role="radio"
                    aria-checked={activeKeyword?.id === k.id}
                    onClick={() => useGiaStore.getState().setNativeWakeKeyword(k.id)}
                    className="px-3 py-1.5 rounded text-[11px] font-medium"
                    style={{
                      background: activeKeyword?.id === k.id ? '#a855f7' : 'var(--gia-bg-2)',
                      color: activeKeyword?.id === k.id ? 'white' : 'var(--gia-muted)',
                    }}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs" style={{ color: 'var(--gia-text)' }}>
                Say &ldquo;{activeKeyword?.label ?? 'Hey Jarvis'}&rdquo;
              </div>
            )}
            <p className="text-[9px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
              For now GIA answers to &ldquo;Hey Jarvis&rdquo; &mdash; that is the phrase the on-device model was trained on. A custom &ldquo;Hey GIA&rdquo; voice is coming in a later update.
            </p>
          </div>

          <div>
            <label htmlFor="wake-sensitivity" className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
              Sensitivity: {sensitivity.toFixed(2)} &middot; triggers at {Math.round(threshold * 100)}% confidence
            </label>
            <input
              id="wake-sensitivity"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sensitivity}
              onChange={e => setSensitivity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#a855f7' }}
            />
            <div className="flex justify-between text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
              <span>Fewer false triggers</span>
              <span>Catches quieter speech</span>
            </div>
          </div>
        </>
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

      <Switch
        checked={modelVoiceEnabled}
        onChange={v => { setModelVoiceEnabled(v); TTSService.setModelVoiceEnabled(v); }}
        label="Model Voice"
        description="Use the model's own voice (OpenAI / Gemini native speech) instead of the device voice. Auto-falls back to device TTS when unavailable."
        accentColor="#a855f7"
      />

      <div className="border-t" style={{ borderColor: 'var(--gia-border)', margin: '4px 0' }} />

      <div className="flex items-center gap-2">
        <Download size={14} style={{ color: '#22c55e' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          On-Device Whisper
        </span>
      </div>
      <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
        Uses Whisper ONNX model (tiny.en, ~50MB) for on-device speech-to-text. No data leaves your phone.
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            if (whisperLoading) return;
            setWhisperLoading(true);
            try {
              if (WhisperService.isReady) {
                await WhisperService.unload();
                setWhisperStatus('unloaded');
              } else {
                await WhisperService.loadModel();
                setWhisperStatus('ready');
              }
            } catch {
              setWhisperStatus('error');
            } finally {
              setWhisperLoading(false);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium transition-colors"
          style={{
            background: whisperStatus === 'ready' ? 'rgba(239,68,68,0.15)' : WhisperService.status === 'loading' ? 'var(--gia-bg-2)' : '#22c55e',
            color: whisperStatus === 'ready' ? '#ef4444' : whisperLoading ? 'var(--gia-muted)' : 'white',
          }}
        >
          {whisperLoading ? 'Downloading…' : whisperStatus === 'ready' ? 'Unload Model' : 'Download Whisper'}
        </button>
        <span className="text-[9px]" style={{ color: whisperStatus === 'ready' ? '#22c55e' : whisperStatus === 'error' ? '#ef4444' : 'var(--gia-muted-2)' }}>
          {whisperStatus === 'ready' ? '✓ Loaded' : whisperStatus === 'error' ? 'Error' : whisperStatus === 'loading' ? 'Downloading ~50MB…' : 'Not loaded'}
        </span>
      </div>

      <Switch
        checked={useWhisper}
        onChange={v => { setUseWhisper(v); useGiaStore.getState().setUseWhisper(v); }}
        icon={<Download size={11} />}
        label="Use On-Device Whisper"
        description="When enabled, mic button records audio and transcribes via on-device Whisper (instead of browser STT)."
        accentColor="#22c55e"
      />

      <div className="border-t" style={{ borderColor: 'var(--gia-border)', margin: '4px 0' }} />

      <div className="flex items-center gap-2">
        <Cloud size={14} style={{ color: '#38bdf8' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Orb Cloud STT
        </span>
      </div>
      <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
        Fallback for the floating orb when Whisper isn't downloaded. Sends your voice clip to an OpenAI-compatible
        <b> /audio/transcriptions </b> endpoint (OpenAI, Groq, ...) — audio leaves the phone for these calls.
      </p>

      <Switch
        checked={cloudStt.enabled}
        onChange={v => setCloudStt(saveCloudSTTConfig({ enabled: v }))}
        icon={<Cloud size={11} />}
        label="Enable Cloud STT fallback"
        description="Only used when on-device Whisper isn't ready."
        accentColor="#38bdf8"
      />

      {cloudStt.enabled && (
        <>
          <div>
            <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
              API Key
            </label>
            <input
              className="gia-input"
              type="password"
              value={cloudStt.apiKey}
              onChange={e => setCloudStt(saveCloudSTTConfig({ apiKey: e.target.value }))}
              placeholder="sk-…"
              style={{ fontSize: '12px', flex: 1 }}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
              Base URL
            </label>
            <input
              className="gia-input"
              value={cloudStt.baseUrl}
              onChange={e => setCloudStt(saveCloudSTTConfig({ baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              style={{ fontSize: '12px', flex: 1 }}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
              Model
            </label>
            <input
              className="gia-input"
              value={cloudStt.model}
              onChange={e => setCloudStt(saveCloudSTTConfig({ model: e.target.value }))}
              placeholder="gpt-4o-mini-transcribe"
              style={{ fontSize: '12px', flex: 1 }}
            />
            <p className="text-[9px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
              Defaults: OpenAI <b>gpt-4o-mini-transcribe</b> · Groq <b>whisper-large-v3-turbo</b> (with
              base URL <b>https://api.groq.com/openai/v1</b>).
            </p>
          </div>
        </>
      )}

      {/* ── Diagnostics Section ───────────────────────────────────── */}
      <div className="flex items-center gap-2 mt-4">
        <Activity size={14} style={{ color: '#a855f7' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Wake Word Diagnostics
        </span>
      </div>

      {/* Status Badges */}
      <div className="grid grid-cols-3 gap-2">
        {/* Service status */}
        <div className="flex flex-col items-center gap-1 p-2 rounded" style={{ background: 'var(--gia-bg-2)' }}>
          {serviceStatus.running
            ? <Mic size={14} className="text-emerald-400" />
            : <MicOff size={14} className="text-zinc-500" />}
          <span className={`text-[9px] font-medium ${serviceStatus.running ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {serviceStatus.running ? 'Running' : serviceStatus.error ? 'Error' : 'Idle'}
          </span>
        </div>
        {/* Mic permission */}
        <div className="flex flex-col items-center gap-1 p-2 rounded" style={{ background: 'var(--gia-bg-2)' }}>
          {serviceStatus.micPermission === true
            ? <Mic size={14} className="text-emerald-400" />
            : serviceStatus.micPermission === false
              ? <AlertTriangle size={14} className="text-rose-400" />
              : <MicOff size={14} className="text-zinc-500" />}
          <span className={`text-[9px] font-medium ${
            serviceStatus.micPermission === true ? 'text-emerald-400'
              : serviceStatus.micPermission === false ? 'text-rose-400'
                : 'text-zinc-500'
          }`}>
            {serviceStatus.micPermission === true ? 'Mic OK'
              : serviceStatus.micPermission === false ? 'No Mic'
                : 'Unknown'}
          </span>
        </div>
        {/* Model loaded */}
        <div className="flex flex-col items-center gap-1 p-2 rounded" style={{ background: 'var(--gia-bg-2)' }}>
          {serviceStatus.modelLoaded
            ? <Activity size={14} className="text-emerald-400" />
            : <Activity size={14} className="text-zinc-500" />}
          <span className={`text-[9px] font-medium ${serviceStatus.modelLoaded ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {serviceStatus.modelLoaded ? 'Model Ready' : 'No Model'}
          </span>
        </div>
      </div>

      {/* Service error */}
      {serviceStatus.error && (
        <div className="text-[9px] p-2 rounded" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.08)' }}>
          <AlertTriangle size={10} className="inline mr-1" />
          {serviceStatus.error}
        </div>
      )}

      {/* Native module missing — explain why real testing isn't possible yet */}
      {!hasNativeModule && (
        <div className="text-[9px] p-2 rounded" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.08)' }}>
          <AlertTriangle size={10} className="inline mr-1" />
          Live testing needs the Android app. You can preview the log with clearly labeled fake data below.
        </div>
      )}

      {/* Live confidence meter (only while a test is running) */}
      {testing && (
        <div>
          <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--gia-muted)' }}>
            <span>Say &ldquo;{activeKeyword?.label ?? 'Hey Jarvis'}&rdquo;</span>
            <span>{Math.round(liveScore * 100)}%</span>
          </div>
          <div
            className="relative h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--gia-bg-2)' }}
            role="meter"
            aria-label="Wake word confidence"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(liveScore * 100)}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, liveScore * 100)}%`,
                background: liveScore >= threshold ? '#34d399' : '#a855f7',
                transition: reduceMotion ? 'none' : 'width 120ms linear',
              }}
            />
            <div className="absolute top-0 bottom-0" style={{ left: `${threshold * 100}%`, width: 2, background: 'var(--gia-text, white)', opacity: 0.7 }} />
          </div>
          <p className="text-[9px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
            The marker is where a detection fires. Testing replaces background listening until you stop.
          </p>
        </div>
      )}

      {/* Test Button */}
      <div className="flex gap-2">
        <button
          onClick={testWakeWord}
          disabled={!hasNativeModule}
          title={!hasNativeModule ? 'Needs the Android app' : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: testing ? 'var(--gia-bg-2)' : '#a855f7', color: testing ? 'var(--gia-text, white)' : 'white' }}
        >
          {testing ? <Square size={11} /> : <Play size={11} />}
          {testing ? 'Stop test' : 'Test Wake Word'}
        </button>
        {!hasNativeModule && (
          <button
            onClick={previewSimulatedLog}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium border border-dashed"
            style={{ background: 'transparent', color: 'var(--gia-muted)', borderColor: 'var(--gia-muted)' }}
          >
            Preview UI (fake data)
          </button>
        )}
        <button
          onClick={() => setDetectionLog([])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium"
          style={{ background: 'var(--gia-bg-2)', color: 'var(--gia-muted)' }}
        >
          Clear Log
        </button>
      </div>

      {/* Detection Log */}
      {detectionLog.length > 0 && (
        <div className="p-2 rounded max-h-28 overflow-y-auto" style={{ background: 'var(--gia-bg-2)', fontFamily: 'monospace', fontSize: '10px' }}>
          {detectionLog.map(e => {
            const confPct = Math.round(e.confidence * 100);
            const time = new Date(e.timestamp).toLocaleTimeString();
            return (
              <div key={e.id} className="flex items-center gap-2 py-0.5" style={e.simulated ? { opacity: 0.7 } : undefined}>
                <span className="text-zinc-500 shrink-0">{time}</span>
                {e.simulated && (
                  <span className="shrink-0 px-1 rounded text-[8px] font-bold" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                    SIMULATED
                  </span>
                )}
                <span style={{ color: confPct > 80 ? '#34d399' : confPct > 50 ? '#fbbf24' : '#f87171' }}>
                  {e.text}
                </span>
                <span className="text-zinc-500 shrink-0">({confPct}%)</span>
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
};