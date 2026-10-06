import { describe, it, expect, vi, beforeEach } from 'vitest';

const whisper = { isReady: true, loadModel: vi.fn(), transcribe: vi.fn() };
const cloud = { configured: false, transcribe: vi.fn() };
const store = { useWhisper: false };

vi.mock('../WhisperService', () => ({ default: whisper }));
vi.mock('../CloudSTT', () => ({
  isCloudSTTConfigured: () => cloud.configured,
  cloudTranscribe: (b: Blob) => cloud.transcribe(b),
}));
vi.mock('../../store/useGiaStore', () => ({ useGiaStore: { getState: () => store } }));

const { transcribeVoiceNote, VoiceNoteError } = await import('../voiceNote');

const big = () => new Blob([new Uint8Array(5000)], { type: 'audio/webm' });

describe('transcribeVoiceNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whisper.isReady = true;
    cloud.configured = false;
    store.useWhisper = false;
  });

  it('rejects mis-taps without calling an engine', async () => {
    await expect(transcribeVoiceNote(new Blob([new Uint8Array(10)]))).rejects.toMatchObject({ code: 'empty' });
    expect(whisper.transcribe).not.toHaveBeenCalled();
  });

  it('prefers cloud transcription when it is configured', async () => {
    cloud.configured = true;
    cloud.transcribe.mockResolvedValue('  hello from the cloud ');
    expect(await transcribeVoiceNote(big())).toBe('hello from the cloud');
    expect(whisper.transcribe).not.toHaveBeenCalled();
  });

  it('uses Whisper when enabled and loads it on first use', async () => {
    store.useWhisper = true;
    whisper.isReady = false;
    whisper.loadModel.mockImplementation(async () => { whisper.isReady = true; });
    whisper.transcribe.mockResolvedValue('hello');
    const status = vi.fn();
    expect(await transcribeVoiceNote(big(), status)).toBe('hello');
    expect(whisper.loadModel).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith('Loading Whisper…');
  });

  it('explains what to set up when there is no engine', async () => {
    whisper.isReady = false;
    const err = await transcribeVoiceNote(big()).catch(e => e);
    expect(err).toBeInstanceOf(VoiceNoteError);
    expect(err.code).toBe('no-engine');
    expect(err.message).toMatch(/Whisper/);
  });

  it('reports silence as empty, not as a crash', async () => {
    store.useWhisper = true;
    whisper.transcribe.mockResolvedValue('   ');
    await expect(transcribeVoiceNote(big())).rejects.toMatchObject({ code: 'empty' });
  });

  it('wraps engine failures', async () => {
    store.useWhisper = true;
    whisper.transcribe.mockRejectedValue(new Error('boom'));
    await expect(transcribeVoiceNote(big())).rejects.toMatchObject({ code: 'failed', message: 'boom' });
  });
});
