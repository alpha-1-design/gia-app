import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let storeState: Record<string, unknown> = {};

vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: vi.fn(() => storeState),
      setState: vi.fn((updates: unknown) => {
        if (typeof updates === 'function') {
          storeState = updates(storeState);
        } else {
          storeState = { ...storeState, ...(updates as Record<string, unknown>) };
        }
      }),
    }
  ),
}));

const mockAddNotification = vi.fn();

const { useChatMessages } = await import('../useChatMessages');

describe('useChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      sessions: [{ id: 'sess-1', messages: [{ id: 'm1', role: 'user', content: 'hi' }, { id: 'm2', role: 'assistant', content: 'hello' }] }],
      activeSessionId: 'sess-1',
      addNotification: mockAddNotification,
      forkSession: vi.fn(),
      addBranch: vi.fn(),
      getActiveSession: vi.fn(() => (storeState.sessions as Array<{ id: string; messages: Array<{ id: string; role: string; content: string }> }>)[0]),
    };
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useChatMessages());
    expect(result.current.undoMsg).toBeNull();
    expect(result.current.copiedId).toBeNull();
    expect(result.current.showBranchView).toBe(false);
  });

  it('handleFork calls forkSession on active session', () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => result.current.handleFork('m1'));
    expect(storeState.forkSession).toHaveBeenCalledWith('sess-1', 'm1');
  });

  it('handleCreateBranch calls addBranch', () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => result.current.handleCreateBranch('m1'));
    expect(storeState.addBranch).toHaveBeenCalledWith('sess-1', 'm1');
  });

  it('handleDeleteWithUndo removes message and stores backup', () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => result.current.handleDeleteWithUndo('m1'));
    expect(result.current.undoMsg).not.toBeNull();
    expect(result.current.undoMsg!.id).toBe('m1');
  });

  it('handleUndoDelete restores backup and clears undo', () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => result.current.handleDeleteWithUndo('m1'));
    act(() => result.current.handleUndoDelete());
    expect(result.current.undoMsg).toBeNull();
    expect(mockAddNotification).toHaveBeenCalledWith('Message restored');
  });

  it('copyMessage sets copiedId', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { result } = renderHook(() => useChatMessages());
    await act(async () => {
      await result.current.copyMessage('m1', 'hello');
    });
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result.current.copiedId).toBe('m1');
  });

  it('showBranchView toggles', () => {
    const { result } = renderHook(() => useChatMessages());
    act(() => result.current.setShowBranchView(true));
    expect(result.current.showBranchView).toBe(true);
  });
});
