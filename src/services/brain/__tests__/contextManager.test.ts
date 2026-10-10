import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetContextTokens = vi.hoisted(() => vi.fn());
vi.mock('../../ProviderRegistry', () => ({
  providerRegistry: { getContextTokens: mockGetContextTokens },
}));

const mockGenerate = vi.hoisted(() => vi.fn());
vi.mock('../../GiaBrain', () => ({ default: { generate: mockGenerate } }));

let providerState: { activeProvider: string; providers: Record<string, { model: string }> };
let summarizationState: {
  contextWindowLimit: number;
  getSummaries: ReturnType<typeof vi.fn>;
  addSummary: ReturnType<typeof vi.fn>;
};

vi.mock('../../../store/useProviderStore', () => ({
  useProviderStore: { getState: () => providerState },
}));
vi.mock('../../../store/useSummarizationStore', () => ({
  useSummarizationStore: { getState: () => summarizationState },
}));
vi.mock('../../../store/useGiaStore', () => ({
  useGiaStore: { getState: () => ({ addNotification: vi.fn() }) },
}));

import {
  estimateTokens,
  estimateHistoryTokens,
  getEffectiveContextLimit,
  autoSummarizeIfNeeded,
} from '../contextManager';

const historyOf = (count: number, chars: number) =>
  Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'x'.repeat(chars),
  }));

describe('contextManager', () => {
  beforeEach(() => {
    providerState = {
      activeProvider: 'opencode',
      providers: { opencode: { model: 'deepseek-v4.1-flash' } },
    };
    summarizationState = {
      contextWindowLimit: 8000,
      getSummaries: vi.fn(() => []),
      addSummary: vi.fn(),
    };
    mockGetContextTokens.mockReset();
    mockGenerate.mockReset();
  });

  it('estimates tokens from character counts', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('')).toBe(0);
    expect(estimateHistoryTokens(historyOf(2, 4))).toBe(1 + 10 + 1 + 10);
  });

  it('uses the real models.dev window when available', () => {
    mockGetContextTokens.mockReturnValue(128000);
    expect(getEffectiveContextLimit()).toEqual({ limit: 128000, fromModel: true });
    expect(mockGetContextTokens).toHaveBeenCalledWith('opencode', 'deepseek-v4.1-flash');
  });

  it('falls back to the configured limit when models.dev has no window', () => {
    mockGetContextTokens.mockReturnValue(undefined);
    expect(getEffectiveContextLimit()).toEqual({ limit: 8000, fromModel: false });
  });

  it('does not summarize an 80k-token history when the model window is 128k', async () => {
    mockGetContextTokens.mockReturnValue(128000);
    const history = historyOf(16, 20000); // ~80k tokens, under the 112k soft limit
    const result = await autoSummarizeIfNeeded(history, 's1', 'b1');
    expect(result.wasSummarized).toBe(false);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('summarizes once the model-aware budget is exceeded', async () => {
    mockGetContextTokens.mockReturnValue(20000); // soft limit ~ max(2000, 4000) = 4000
    mockGenerate.mockResolvedValue({ text: 'a concise summary of the older turns' });
    const history = historyOf(10, 20000); // ~5k tokens > 4k
    const result = await autoSummarizeIfNeeded(history, 's1', 'b1');
    expect(result.wasSummarized).toBe(true);
    expect(summarizationState.addSummary).toHaveBeenCalledTimes(1);
  });
});
