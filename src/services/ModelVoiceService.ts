import { useProviderStore } from '../store/useProviderStore';
import { providerRegistry } from './ProviderRegistry';
import { corsProxy } from './CorsProxy';
import { logger } from '../utils/logger';

/**
 * ModelVoiceService — speaks responses with the chat model's OWN voice,
 * not the device's generic TTS engine.
 *
 * Currently supported native speech backends among the app's providers:
 *  - OpenAI:      POST /audio/speech  (gpt-4o-mini-tts, tts-1)  → mp3 bytes
 *  - Google Gemini: POST /v1beta/interactions (gemini-2.5-flash-preview-tts,
 *                 gemini-2.5-pro-preview-tts, gemini-3.1-flash-tts-preview)
 *                 → raw PCM (24kHz mono) audio, wrapped in a WAV container here
 *
 * Every other provider (OpenRouter, Groq, Mistral, local, …) has no native
 * LLM speech endpoint, so callers fall back to device TTS.
 */

const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const GEMINI_VOICE = 'Kore';
const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const OPENAI_VOICE = 'alloy';

/** Long replies are cut so a single TTS generation stays fast (a few seconds). */
const MAX_TTS_CHARS = 3000;

/** The <audio> currently playing model speech, if any — so stop() can cut it. */
let currentAudio: HTMLAudioElement | null = null;

export type NativeVoiceProvider = 'openai' | 'gemini' | null;

/** Which provider, if any, can speak natively with the currently active model. */
export function getNativeVoiceProvider(): NativeVoiceProvider {
  const { activeProvider, providers } = useProviderStore.getState();
  const cfg = providers[activeProvider];
  if (!cfg?.enabled || !cfg?.apiKey) return null;
  if (activeProvider === 'openai') return 'openai';
  if (activeProvider === 'gemini') return 'gemini';
  // A user-set custom OpenAI-compatible base URL (e.g. Azure OpenAI or a
  // local OpenAI-compatible server) may expose /audio/speech too.
  const def = providerRegistry.getProvider(activeProvider);
  const baseUrl = cfg.baseUrl || def?.baseUrl || '';
  if (def?.listingType === 'openai' && /openai\.com|azure\.com/i.test(baseUrl)) return 'openai';
  return null;
}

/**
 * Try to speak with the model's native voice. Returns true when spoken;
 * false when unsupported or the request failed (caller falls back to TTS).
 */
export async function speakWithModelVoice(text: string): Promise<boolean> {
  const provider = getNativeVoiceProvider();
  if (!provider) return false;
  try {
    const ok = provider === 'openai' ? await speakWithOpenAI(text) : await speakWithGemini(text);
    return ok;
  } catch (e) {
    logger.warn('[ModelVoice] native speech failed, falling back to device TTS:', e);
    return false;
  }
}

export function stopModelVoice() {
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* ignore */ }
    currentAudio = null;
  }
}

// ── OpenAI ────────────────────────────────────────────────────────────────

async function speakWithOpenAI(text: string): Promise<boolean> {
  const { activeProvider, providers } = useProviderStore.getState();
  const cfg = providers[activeProvider];
  const def = providerRegistry.getProvider('openai');
  const baseUrl = cfg?.baseUrl || def?.baseUrl || 'https://api.openai.com/v1';

  const res = await corsProxy.fetch(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg?.apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      input: text.slice(0, MAX_TTS_CHARS),
      voice: OPENAI_VOICE,
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return false;
  const blob = await res.blob();
  return playBlob(blob);
}

// ── Google Gemini ─────────────────────────────────────────────────────────

async function speakWithGemini(text: string): Promise<boolean> {
  const { activeProvider, providers } = useProviderStore.getState();
  const cfg = providers[activeProvider];

  const res = await corsProxy.fetch(GEMINI_TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': cfg?.apiKey || '',
    },
    body: JSON.stringify({
      model: GEMINI_TTS_MODEL,
      input: text.slice(0, MAX_TTS_CHARS),
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: GEMINI_VOICE }],
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return false;

  const json = (await res.json()) as { output_audio?: { data?: string } };
  const b64 = json?.output_audio?.data;
  if (!b64) return false;

  // output_audio.data is RAW PCM (16-bit, 24kHz, mono). Wrap it in a WAV
  // container so browsers/WebView can play it.
  const bytes = base64ToBytes(b64);
  const wav = pcm16ToWav(bytes, 24000, 1);
  return playBlob(new Blob([wav], { type: 'audio/wav' }));
}

// ── Playback ──────────────────────────────────────────────────────────────

function playBlob(blob: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      let settled = false;
      const cleanup = (ok: boolean) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        resolve(ok);
      };
      const safety = setTimeout(() => cleanup(true), 120000);
      audio.onended = () => { clearTimeout(safety); cleanup(true); };
      audio.onerror = () => { clearTimeout(safety); cleanup(false); };
      audio.play().catch(() => { clearTimeout(safety); cleanup(false); });
    } catch {
      resolve(false);
    }
  });
}

// ── Binary helpers ────────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function pcm16ToWav(pcm: Uint8Array, sampleRate: number, channels: number): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);            // PCM chunk size
  view.setUint16(20, 1, true);             // audio format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);            // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(pcm);
  return buffer;
}
