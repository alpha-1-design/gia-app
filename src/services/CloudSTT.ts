import { logger } from '../utils/logger';

/**
 * CloudSTT — optional cloud speech-to-text fallback for the floating orb.
 *
 * When on-device Whisper isn't downloaded, orb voice clips can be sent to an
 * OpenAI-compatible `/audio/transcriptions` endpoint (OpenAI, Groq, ...).
 * Audio LEAVES the device for these calls — it's opt-in only, and Whisper
 * (fully offline) is always preferred when it's loaded.
 */
export interface CloudSTTConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
}

const STORAGE_KEY = 'gia:cloud-stt';

export const CLOUD_STT_DEFAULTS: CloudSTTConfig = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini-transcribe',
};

export function getCloudSTTConfig(): CloudSTTConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...CLOUD_STT_DEFAULTS };
    return { ...CLOUD_STT_DEFAULTS, ...(JSON.parse(raw) as Partial<CloudSTTConfig>) };
  } catch {
    return { ...CLOUD_STT_DEFAULTS };
  }
}

export function saveCloudSTTConfig(patch: Partial<CloudSTTConfig>): CloudSTTConfig {
  const next = { ...getCloudSTTConfig(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota — keep in-memory value
  }
  return next;
}

/** Thrown when cloud STT is unavailable or the request fails — message is user-facing. */
export class CloudSTTError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudSTTError';
  }
}

/** True when an OpenAI-compatible `/audio/transcriptions` endpoint is configured. */
export function isCloudSTTConfigured(): boolean {
  const cfg = getCloudSTTConfig();
  return cfg.enabled && !!cfg.apiKey.trim() && !!cfg.baseUrl.trim() && !!cfg.model.trim();
}

/** Transcribe a voice clip through the configured endpoint. Throws CloudSTTError on any failure. */
export async function cloudTranscribe(blob: Blob): Promise<string> {
  const cfg = getCloudSTTConfig();
  if (!cfg.enabled) throw new CloudSTTError('Cloud STT is disabled.');
  if (!cfg.apiKey.trim()) throw new CloudSTTError('Cloud STT has no API key.');
  if (!cfg.baseUrl.trim()) throw new CloudSTTError('Cloud STT has no base URL.');

  const base = cfg.baseUrl.trim().replace(/\/+$/, '');
  const url = `${base}/audio/transcriptions`;

  const form = new FormData();
  form.append('file', blob, 'orb_capture.m4a');
  form.append('model', cfg.model.trim() || CLOUD_STT_DEFAULTS.model);
  form.append('response_format', 'json');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey.trim()}` },
      body: form,
    });
  } catch (err) {
    throw new CloudSTTError(
      `Cloud STT unreachable at ${base}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new CloudSTTError(`Cloud STT failed (${res.status}): ${body.slice(0, 140)}`);
  }

  const data = (await res.json().catch(() => null)) as { text?: string } | null;
  const text = data && typeof data.text === 'string' ? data.text.trim() : '';
  logger.log(`[CloudSTT] transcribed ${text.length} chars`);
  return text;
}