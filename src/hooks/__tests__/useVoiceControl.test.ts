import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockAvailable = vi.fn();
const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();

vi.mock('@capgo/capacitor-speech-recognition', () => ({
  SpeechRecognition: {
    available: (...args: unknown[]) => mockAvailable(...args),
    start: (...args: unknown[]) => mockStart(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: vi.fn(() => false) },
}));

vi.mock('../../services/TTSService', () => ({
  default: { isSpeaking: vi.fn(() => false) },
}));

// Simulate a Capacitor-native environment so the plugin (not browser Web Speech) path is used.
(globalThis as unknown as { Capacitor?: unknown }).Capacitor = {};

const { useVoiceControl } = await import('../useVoiceControl');

describe('useVoiceControl — listenOnce microphone loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockAvailable.mockResolvedValue({ available: true });
    mockCheckPermissions.mockResolvedValue({ speechRecognition: 'granted' });
    mockRequestPermissions.mockResolvedValue({ speechRecognition: 'granted' });
  });

  it('requests partialResults:false so the awaited result actually contains a transcript', async () => {
    mockStart.mockResolvedValue({ matches: ['hello gia'] });
    const onTranscript = vi.fn();

    const { result } = renderHook(() => useVoiceControl({ onTranscript, keepListening: false }));

    await act(async () => {
      await result.current.startListening(true);
    });

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({ partialResults: false }),
    );
  });

  it('does not repeatedly re-invoke the microphone when every call resolves with no matches', async () => {
    // This reproduces the reported bug: previously start() was called with
    // partialResults:true, which resolves immediately with empty matches on
    // every call, causing an unbounded restart loop that kept re-triggering
    // the OS microphone indicator without ever capturing speech.
    mockStart.mockResolvedValue({ matches: [] });

    const { result } = renderHook(() => useVoiceControl({ onTranscript: vi.fn(), keepListening: true }));

    await act(async () => {
      await result.current.startListening(true);
    });

    // Advance well past the point where the old bug would have caused ~10+ restarts.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35000);
    });

    // The loop is capped (listenOnceCountRef > 20) and backs off 3s between empty
    // results, so within 35s we expect a small, bounded number of mic invocations —
    // not a tight repeated-call loop.
    expect(mockStart.mock.calls.length).toBeGreaterThan(0);
    expect(mockStart.mock.calls.length).toBeLessThanOrEqual(12);

    await act(async () => {
      await result.current.stopListening();
    });
  });
});
