import WhisperService from './WhisperService';
import { cloudTranscribe, isCloudSTTConfigured } from './CloudSTT';
import { useGiaStore } from '../store/useGiaStore';

export type VoiceNoteErrorCode = 'no-engine' | 'empty' | 'failed';

export class VoiceNoteError extends Error {
  constructor(public code: VoiceNoteErrorCode, message: string) {
    super(message);
    this.name = 'VoiceNoteError';
  }
}

/** A recording this small is a mis-tap, not speech. */
const MIN_BYTES = 1000;

/**
 * Turn a recorded voice note into text. Uses cloud transcription when it is
 * set up, otherwise on-device Whisper (loading it on first use). If neither is
 * available the caller gets a clear error instead of a silent nothing.
 */
export async function transcribeVoiceNote(blob: Blob, onStatus?: (msg: string) => void): Promise<string> {
  if (blob.size < MIN_BYTES) throw new VoiceNoteError('empty', 'That was too short to hear anything.');

  try {
    if (isCloudSTTConfigured()) {
      onStatus?.('Transcribing…');
      const text = (await cloudTranscribe(blob)).trim();
      if (text) return text;
      throw new VoiceNoteError('empty', "I couldn't hear any speech in that.");
    }

    const wantsWhisper = useGiaStore.getState().useWhisper || WhisperService.isReady;
    if (!wantsWhisper) {
      throw new VoiceNoteError('no-engine', 'Voice notes need a transcription engine. Turn on Whisper (on-device) or add cloud transcription in Settings > Voice.');
    }
    if (!WhisperService.isReady) {
      onStatus?.('Loading Whisper…');
      await WhisperService.loadModel();
    }
    onStatus?.('Transcribing…');
    const text = (await WhisperService.transcribe(blob)).trim();
    if (!text) throw new VoiceNoteError('empty', "I couldn't hear any speech in that.");
    return text;
  } catch (e) {
    if (e instanceof VoiceNoteError) throw e;
    throw new VoiceNoteError('failed', e instanceof Error ? e.message : 'Transcription failed.');
  }
}
