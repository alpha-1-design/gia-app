import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface WakeWordKeyword {
  /** Stable id, e.g. "hey_jarvis". Matches the model file name without version. */
  id: string;
  /** Human readable, e.g. "Hey Jarvis". */
  label: string;
}

export interface WakeWordStatus {
  running: boolean;
  /** True while the microphone is handed over to speech recognition. */
  paused: boolean;
  /** Label of the phrase currently being listened for ("" when stopped). */
  keyword: string;
  /** Score (0-1) a frame must reach to count as a detection. */
  threshold: number;
  lastScore: number;
  error: string;
  micPermission: boolean;
}

export interface GIAWakeWordPlugin {
  startListening(options?: {
    /** Keyword id or phrase ("hey_jarvis", "Hey Jarvis"). Unknown values fall back to the first bundled model. */
    keyword?: string;
    /** 0 (strict) to 1 (eager). */
    sensitivity?: number;
    /** Absolute path to an openWakeWord classifier (.onnx) outside the APK. */
    customModelPath?: string;
    /** Stream `wakeWordScore` events (for the live meter). Costs a bridge call every ~240 ms. */
    emitScores?: boolean;
  }): Promise<void>;

  stopListening(): Promise<void>;

  /** Release the microphone for speech recognition. Resumes by itself after 20 s. */
  pause(): Promise<void>;
  resume(): Promise<void>;

  isListening(): Promise<{ listening: boolean }>;

  getStatus(): Promise<WakeWordStatus>;

  /** Wake phrases bundled in the app. */
  listKeywords(): Promise<{ keywords: WakeWordKeyword[] }>;

  /** A detection that happened while the UI was not attached (cold start from the background). */
  getPendingWakeWord(): Promise<{ detected: boolean; keyword: string }>;

  addListener(
    eventName: 'wakeWordDetected',
    handler: (result: { keyword: string; score?: number }) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'wakeWordScore',
    handler: (result: { score: number }) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'wakeWordError',
    handler: (result: { error: string }) => void
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}

const GIAWakeWord = registerPlugin<GIAWakeWordPlugin>('GIAWakeWord', {
  web: () => import('./GIAWakeWord.web').then(m => m.GIAWakeWordWeb),
});

export { GIAWakeWord };
