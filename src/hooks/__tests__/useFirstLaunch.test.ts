import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFirstLaunch } from '../useFirstLaunch';

vi.mock('../../services/SystemDiagnostics', () => ({
  SystemDiagnostics: {
    runDiagnostics: vi.fn(async () => ({
      system: { batteryLevel: 100, storageFree: '10GB', networkStatus: 'online' },
      provider: { connected: true, name: 'test' },
      capabilities: { a: true },
      tools: { total: 5 },
    })),
  },
}));

vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: { getState: () => ({ sessions: [] }) },
}));

// Regression test for the crash reported as "Minified React error #185 —
// Maximum update depth exceeded". Root cause: runDiagnostics used to be a
// plain function recreated on every render, and App.tsx put it in a
// useEffect dependency array. Because shouldRunDiagnostics was never reset,
// the effect fired again on every unrelated re-render, re-triggering
// addNotification and cascading forever. This locks in the fix: the
// returned runDiagnostics reference is stable across renders, and
// shouldRunDiagnostics resets to false so a consumer effect only fires once.
describe('useFirstLaunch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a stable runDiagnostics reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useFirstLaunch());
    const first = result.current.runDiagnostics;
    rerender();
    rerender();
    expect(result.current.runDiagnostics).toBe(first);
  });

  it('flips shouldRunDiagnostics to true on first launch (no sessions)', () => {
    const { result } = renderHook(() => useFirstLaunch());
    expect(result.current.shouldRunDiagnostics).toBe(true);
  });

  it('exposes a setter that lets a consumer reset the flag to a one-shot false', () => {
    const { result } = renderHook(() => useFirstLaunch());
    expect(result.current.shouldRunDiagnostics).toBe(true);
    act(() => {
      result.current.setShouldRunDiagnostics(false);
    });
    expect(result.current.shouldRunDiagnostics).toBe(false);
  });
});
