import { describe, it, expect, vi, beforeEach } from 'vitest';

let storeState: Record<string, unknown> = {};

vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: vi.fn(() => storeState),
      setState: vi.fn((updates: unknown) => {
        if (typeof updates === 'function') {
          storeState = (updates as (s: Record<string, unknown>) => Record<string, unknown>)(storeState);
        } else {
          storeState = { ...storeState, ...(updates as Record<string, unknown>) };
        }
      }),
    }
  ),
}));

vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { handleWidgetAction } = await import('../useNativeIntents');

describe('handleWidgetAction', () => {
  let setModule: ReturnType<typeof vi.fn>;
  let setShowCircleSearch: ReturnType<typeof vi.fn>;
  let addNotification: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setModule = vi.fn();
    setShowCircleSearch = vi.fn();
    addNotification = vi.fn();
    storeState = { setModule, setShowCircleSearch, addNotification };
  });

  it('routes open_chat to the chat module', () => {
    handleWidgetAction('open_chat');
    expect(setModule).toHaveBeenCalledWith('chat');
    expect(setShowCircleSearch).not.toHaveBeenCalled();
  });

  it('routes screen_capture to chat module + circle search trigger', () => {
    handleWidgetAction('screen_capture');
    expect(setModule).toHaveBeenCalledWith('chat');
    expect(setShowCircleSearch).toHaveBeenCalledWith(true);
  });

  it('routes voice_start to chat module and surfaces that it is unwired, not a silent no-op', () => {
    handleWidgetAction('voice_start');
    expect(setModule).toHaveBeenCalledWith('chat');
    expect(addNotification).toHaveBeenCalledWith(expect.stringContaining("isn't wired up yet"));
  });

  it('does nothing destructive for an unknown action', () => {
    expect(() => handleWidgetAction('something_unexpected')).not.toThrow();
    expect(setModule).not.toHaveBeenCalled();
    expect(setShowCircleSearch).not.toHaveBeenCalled();
  });
});
