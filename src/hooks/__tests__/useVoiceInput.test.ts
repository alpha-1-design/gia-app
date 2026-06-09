import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockStartListening = vi.fn();
const mockStopListening = vi.fn();

vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => {
      const state = { wakeWord: 'hey gia', keepListening: false, voiceLanguage: 'en-US' };
      return selector(state);
    },
    { getState: vi.fn(() => ({
      wakeWord: 'hey gia',
      keepListening: false,
      voiceLanguage: 'en-US',
      addNotification: vi.fn(),
      setInput: vi.fn(),
      setVoiceOverlay: vi.fn(),
    })) }
  ),
}));

vi.mock('../useVoiceControl', () => ({
  useVoiceControl: vi.fn(() => ({
    isListening: false,
    isHearing: false,
    startListening: mockStartListening,
    stopListening: mockStopListening,
  })),
}));

vi.mock('../../services/GiaBrain', () => ({
  default: {
    generate: vi.fn(),
    isVisionCapable: vi.fn(),
  },
}));

const { useVoiceInput } = await import('../useVoiceInput');

describe('useVoiceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial voice state', () => {
    const abortRef = { current: null } as React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const { result } = renderHook(() => useVoiceInput(abortRef));
    expect(result.current.voiceEnabled).toBe(false);
    expect(result.current.voiceLanguage).toBe('en-US');
    expect(result.current.wakeWord).toBe('hey gia');
  });

  it('toggles voiceEnabled', () => {
    const abortRef = { current: null } as React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const { result } = renderHook(() => useVoiceInput(abortRef));
    act(() => result.current.setVoiceEnabled(true));
    expect(result.current.voiceEnabled).toBe(true);
  });

  it('returns voiceControl object from useVoiceControl', () => {
    const abortRef = { current: null } as React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const { result } = renderHook(() => useVoiceInput(abortRef));
    expect(result.current.voiceControl).toBeDefined();
    expect(result.current.voiceControl.startListening).toBe(mockStartListening);
    expect(result.current.voiceControl.stopListening).toBe(mockStopListening);
  });

  it('creates a ref that tracks voiceControl', () => {
    const abortRef = { current: null } as React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const { result } = renderHook(() => useVoiceInput(abortRef));
    expect(result.current.voiceRef.current).toBe(result.current.voiceControl);
    expect(result.current.keepListeningRef.current).toBe(false);
  });

  it('playBeep does not throw', () => {
    const abortRef = { current: null } as React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const { result } = renderHook(() => useVoiceInput(abortRef));
    expect(() => result.current.playBeep()).not.toThrow();
  });

  it('handleWakeWord returns query when wake word is present', () => {
    const abortRef = { current: null } as React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const { result } = renderHook(() => useVoiceInput(abortRef));
    const query = result.current.handleWakeWord('hey gia what is the weather');
    expect(typeof query).toBe('string');
  });

  it('handleVoiceTranscript sets short transcripts directly via setInput', () => {
    const abortRef = { current: null } as React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    const { result } = renderHook(() => useVoiceInput(abortRef));
    const setInput = vi.fn();
    result.current.handleVoiceTranscript('short text', setInput);
    expect(setInput).toHaveBeenCalledWith('short text');
  });
});
