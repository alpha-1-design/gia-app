import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Headphones, Radio, Mic, MicOff, Activity, Play, Square, AlertTriangle, Download } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import TTSService from '../../services/TTSService';
import WhisperService from '../../services/WhisperService';
import { LANGUAGES } from '../../config/constants';
import { Switch } from '../ui/Switch';

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
  const [nativeWW, setNativeWW] = useState(() => localStorage.getItem('gia-native-wake-word') !== 'false');
  const [sensitivity, setSensitivity] = useState(() => parseFloat(localStorage.getItem('gia-native-sensitivity') || '0.7'));
  const [accessKey, setAccessKey] = useState(() => localStorage.getItem('gia-wake-word-access-key') || '');

  const [useWhisper, setUseWhisper] = useState(() => localStorage.getItem('gia-use-whisper') === 'true');
  const [whisperStatus, setWhisperStatus] = useState(WhisperService.status);
  const [whisperLoading, setWhisperLoading] = useState(false);

  // ── Diagnostics state ──────────────────────────────────────────────
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    running: false,
    micPermission: null,
    modelLoaded: false,
  });
  const [testing, setTesting] = useState(false);
  const [detectionLog, setDetectionLog] = useState<DetectionEvent[]>([]);
  const didRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Mock check — will be replaced by CorePlugin in Phase 1
  const checkService = useCallback(async () => {
    try {
      // Check if native module is available
      const hasModule = typeof (window as unknown as { GIAWakeWord?: unknown }).GIAWakeWord !== 'undefined';
      if (hasModule) {
        const status = await (window as unknown as { GIAWakeWord: { getStatus: () => ServiceStatus } }).GIAWakeWord.getStatus();
        setServiceStatus(status);
      } else {
        setServiceStatus({
          running: false,
          micPermission: null,
          modelLoaded: false,
          error: 'Native module not loaded — will be available after GIACoreService build (Phase 1)',
        });
      }
    } catch {
      setServiceStatus(s => ({ ...s, error: 'Failed to check service' }));
    }
  }, []);

  const [hasNativeModule, setHasNativeModule] = useState(false);

  useEffect(() => {
    setHasNativeModule(typeof (window as unknown as { GIAWakeWord?: unknown }).GIAWakeWord !== 'undefined');
  }, []);

  const testWakeWord = useCallback(async () => {
    setTesting(true);
    setDetectionLog([]);
    try {
      await (window as unknown as { GIAWakeWord: { startTest: (n: number) => Promise<void> } }).GIAWakeWord.startTest(detectionLog.length);
    } catch (e) {
      setDetectionLog(prev => [...prev, {
        id: didRef.current++, timestamp: Date.now(),
        text: `Error: ${e instanceof Error ? e.message : 'Unknown'}`,
        confidence: 0,
      }]);
    } finally {
      setTesting(false);
    }
  }, [detectionLog.length]);

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

  useEffect(() => {
    localStorage.setItem('gia-wake-word-access-key', accessKey);
    useGiaStore.getState().setWakeWordAccessKey(accessKey);
  }, [accessKey]);

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

      <Switch
        checked={nativeWW}
        onChange={setNativeWW}
        icon={<Radio size={11} />}
        label="Background Wake Word"
        description="Built-in on-device wake word engine — no account or API key needed. Works when app is in background."
        accentColor="#a855f7"
      />

      {nativeWW && (
        <>
          <div>
            <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
              Sensitivity: {sensitivity.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sensitivity}
              onChange={e => setSensitivity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#a855f7' }}
            />
            <div className="flex justify-between text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
              <span>Fewer detections</span>
              <span>More detections</span>
            </div>
          </div>
          <div className="text-[9px] p-2 rounded" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)' }}>
            <span className="inline-block mr-1">✓</span>
            On-device engine bundled with GIA — 100% offline, no key required.
            Supported phrases: <b>Hey Jarvis</b> (default), Hey Gia, Hello World, Hi Google, Hey Siri, Alexa.
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
          Native wake word module isn't loaded on this build, so real detection can't be tested here. You can preview what the log UI looks like with clearly-labeled fake data below.
        </div>
      )}

      {/* Test Button */}
      <div className="flex gap-2">
        <button
          onClick={testWakeWord}
          disabled={testing || !hasNativeModule}
          title={!hasNativeModule ? 'Native wake word module not available on this build' : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: testing ? 'var(--gia-bg-2)' : '#a855f7', color: testing ? 'var(--gia-muted)' : 'white' }}
        >
          {testing ? <Square size={11} /> : <Play size={11} />}
          {testing ? 'Testing...' : 'Test Wake Word'}
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