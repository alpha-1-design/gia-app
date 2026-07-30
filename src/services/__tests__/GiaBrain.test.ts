import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all external dependencies
const deductTokens = vi.fn();
const setProviderModel = vi.fn();

vi.mock('../../store/useProviderStore', () => ({
  useProviderStore: {
    getState: vi.fn(() => ({
      providers: { openai: { apiKey: 'sk-test', model: 'gpt-4o', enabled: true } },
      activeProvider: 'openai',
      deductTokens,
      setProviderModel,
    })),
  },
}));

vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: {
    getState: vi.fn(() => ({
      responseCache: false,
      addNotification: vi.fn(),
    })),
  },
}));

vi.mock('../ProviderService', () => ({
  default: {
    callProvider: vi.fn(),
  },
}));

vi.mock('../ToolExecutionService', () => ({
  default: {
    execute: vi.fn(),
  },
}));

vi.mock('../ErrorHandlingService', () => ({
  default: {
    handleErrors: vi.fn(),
  },
}));

vi.mock('../brain/modelUtils', () => ({
  selectBestModel: vi.fn(() => ({ model: 'gpt-4o', reason: null, switched: false })),
  buildMessages: vi.fn(() => []),
}));

vi.mock('../brain/memoryExtractor', () => ({
  extractMemories: vi.fn(async () => {}),
}));

vi.mock('../PluginManager', () => ({
  default: {
    runBeforeGenerate: vi.fn(async (p: string) => p),
    runAfterGenerate: vi.fn(async (r: { text: string; provider: string; model: string }) => r),
  },
}));

vi.mock('../AnalyticsTracker', () => ({
  default: {
    trackGenerationComplete: vi.fn(),
  },
}));

vi.mock('../ResponseCache', () => ({
  default: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
}));

vi.mock('../CollaborativeGenerationService', () => ({
  default: {
    generate: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { default: ProviderService } = await import('../ProviderService');
const { default: ToolExecutionService } = await import('../ToolExecutionService');

// Import after mocks
const { default: GiaBrain } = await import('../GiaBrain');

describe('GiaBrain (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a singleton instance', () => {
    expect(GiaBrain).toBeDefined();
    expect(GiaBrain.generate).toBeInstanceOf(Function);
    expect(GiaBrain.generateCollaborative).toBeInstanceOf(Function);
  });

  it('returns text from provider when no tool execution', async () => {
    vi.mocked(ProviderService.callProvider).mockResolvedValueOnce({
      text: 'Hello from AI',
      provider: 'openai',
      model: 'gpt-4o',
    });
    vi.mocked(ToolExecutionService.execute).mockResolvedValueOnce({
      didExecute: false,
      result: undefined,
    });

    const result = await GiaBrain.generate({ prompt: 'Say hi' });
    expect(result.text).toBe('Hello from AI');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o');
  });

  it('passes onStream to provider call and returns final text', async () => {
    vi.mocked(ProviderService.callProvider).mockResolvedValueOnce({
      text: 'Streamed result',
      provider: 'openai',
      model: 'gpt-4o',
    });
    vi.mocked(ToolExecutionService.execute).mockResolvedValueOnce({
      didExecute: false,
      result: undefined,
    });

    const onStream = vi.fn();
    const result = await GiaBrain.generate({ prompt: 'Stream test', onStream });
    expect(result.text).toBe('Streamed result');
  });

  it('executes tool loop and feeds observations back', async () => {
    const callProvider = vi.mocked(ProviderService.callProvider);
    const executeTool = vi.mocked(ToolExecutionService.execute);

    // First iteration — model responds with a tool call
    callProvider.mockResolvedValueOnce({
      text: 'I will use a tool',
      provider: 'openai',
      model: 'gpt-4o',
    });
    executeTool.mockResolvedValueOnce({
      didExecute: true,
      result: undefined,
    });

    // Second iteration — model responds with final answer
    callProvider.mockResolvedValueOnce({
      text: 'Final answer after tool',
      provider: 'openai',
      model: 'gpt-4o',
    });
    executeTool.mockResolvedValueOnce({
      didExecute: false,
      result: undefined,
    });

    const result = await GiaBrain.generate({ prompt: 'Use a tool' });
    expect(result.text).toBe('Final answer after tool');
    expect(callProvider).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenCalledTimes(2);
  });

  it('throws when max iterations reached', async () => {
    vi.mocked(ProviderService.callProvider).mockResolvedValue({
      text: 'tool use',
      provider: 'openai',
      model: 'gpt-4o',
    });
    vi.mocked(ToolExecutionService.execute).mockResolvedValue({
      didExecute: true,
      result: undefined,
    });

    await expect(GiaBrain.generate({ prompt: 'Loop' })).rejects.toThrow('Max agentic iterations reached');
  });

  it('returns clarification signal', async () => {
    vi.mocked(ProviderService.callProvider).mockResolvedValueOnce({
      text: 'clarify?',
      provider: 'openai',
      model: 'gpt-4o',
    });
    vi.mocked(ToolExecutionService.execute).mockResolvedValueOnce({
      didExecute: true,
      result: '__CLARIFICATION__' as const,
    });

    const result = await GiaBrain.generate({ prompt: 'Vague prompt' });
    expect(result.text).toBe('__CLARIFICATION__');
  });

  it('retries on malformed JSON in tool block', async () => {
    const callProvider = vi.mocked(ProviderService.callProvider);
    const executeTool = vi.mocked(ToolExecutionService.execute);

    callProvider.mockResolvedValueOnce({
      text: 'bad json tool',
      provider: 'openai',
      model: 'gpt-4o',
    });
    executeTool.mockResolvedValueOnce({
      didExecute: true,
      result: 'malformed_json' as const,
    });

    callProvider.mockResolvedValueOnce({
      text: 'now fixed',
      provider: 'openai',
      model: 'gpt-4o',
    });
    executeTool.mockResolvedValueOnce({
      didExecute: false,
      result: undefined,
    });

    const result = await GiaBrain.generate({ prompt: 'Fix it' });
    expect(result.text).toBe('now fixed');
    expect(callProvider).toHaveBeenCalledTimes(2);
  });

  it('deducts tokens when usage provided', async () => {
    vi.mocked(ProviderService.callProvider).mockResolvedValueOnce({
      text: 'Done',
      provider: 'openai',
      model: 'gpt-4o',
      tokenUsage: { input: 50, output: 100, total: 150 },
    });
    vi.mocked(ToolExecutionService.execute).mockResolvedValueOnce({
      didExecute: false,
      result: undefined,
    });

    await GiaBrain.generate({ prompt: 'Count tokens' });
    expect(deductTokens).toHaveBeenCalledWith('openai', 150);
  });
});
