import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const addNotificationMock = vi.fn();
let smartFallbackValue = true;

vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: {
    getState: () => ({
      get smartFallback() { return smartFallbackValue; },
      addNotification: addNotificationMock,
    }),
  },
}));

const callProviderMock = vi.fn();
vi.mock('../ProviderService', () => ({
  default: { callProvider: (...args: unknown[]) => callProviderMock(...args) },
}));

vi.mock('../ProviderMonitor', () => ({
  default: {
    recordFailure: vi.fn(),
    recordSuccess: vi.fn(),
    getHealth: () => ({ status: 'healthy' }),
  },
}));

vi.mock('../brain/ResilientRelay', () => ({
  isRateLimitOrQuotaError: (msg: string) => /rate.?limit|quota|429|402/.test(msg),
  isRetryableServerError: (msg: string) => /502|503|504|timeout/.test(msg),
  isAuthError: (msg: string) => /401|403|unauthorized|forbidden|invalid api key|authentication/.test(msg),
  isModelNotFoundError: (msg: string) => /404|model not found|does not exist/.test(msg),
  isRecoverableError: (msg: string) =>
    /rate.?limit|quota|429|402|502|503|504|timeout|401|403|unauthorized|forbidden|invalid api key|authentication|404|model not found|does not exist|network|context length/.test(msg),
  // No same-provider fallback model in these tests -- keeps focus on the
  // same-provider-retry (Step 1) and cross-provider (Step 3) behavior being
  // tested here. Plain function, not vi.fn(): resetAllMocks() in beforeEach
  // would otherwise strip this implementation after the first test.
  pickFallbackModel: () => null,
  backoffDelay: (attempt: number) => 1500 * attempt,
  saveCheckpoint: vi.fn(),
  clearCheckpoint: vi.fn(),
}));

vi.mock('../brain/network', () => ({
  friendlyError: (provider: string, err: Error) => `${provider} failed: ${err.message}`,
}));

let activeProvidersValue: { id: string; config: { model: string } }[] = [];
const providersConfigValue: Record<string, { apiKey?: string; enabled?: boolean; model: string }> = {};
vi.mock('../../store/useProviderStore', () => ({
  useProviderStore: {
    getState: () => ({
      providers: providersConfigValue,
      getActiveProviders: () => activeProvidersValue,
    }),
  },
}));

import ErrorHandlingService from '../ErrorHandlingService';
import ProviderMonitor from '../ProviderMonitor';
import { saveCheckpoint, clearCheckpoint } from '../brain/ResilientRelay';

describe('ErrorHandlingService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    smartFallbackValue = true;
    activeProvidersValue = [];
    for (const k of Object.keys(providersConfigValue)) delete providersConfigValue[k];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseReq = {
    prompt: 'test prompt',
    onThought: vi.fn(),
    onStream: vi.fn(),
    checkpointKey: 'session1:msg1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  it('records failure in ProviderMonitor', async () => {
    callProviderMock.mockRejectedValue(new Error('some error'));
    try {
      await ErrorHandlingService.handleErrors(
        new Error('some error'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
      );
    } catch { /* expected */ }
    expect(ProviderMonitor.recordFailure).toHaveBeenCalledWith('openai', 'gpt-4o', expect.any(String), expect.any(Number));
  });

  it('saves checkpoint on error', async () => {
    callProviderMock.mockRejectedValue(new Error('fail'));
    try {
      await ErrorHandlingService.handleErrors(
        new Error('fail'), baseReq, 'openai', 'gpt-4o', performance.now(), 'accumulated', 1, [],
      );
    } catch { /* expected */ }
    expect(saveCheckpoint).toHaveBeenCalled();
  });

  it('retries on rate limit error and succeeds', async () => {
    callProviderMock
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockResolvedValueOnce({ text: 'recovered' });

    const promise = ErrorHandlingService.handleErrors(
      new Error('rate limit exceeded'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
    );
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result.res).toEqual({ text: 'recovered' });
    expect(ProviderMonitor.recordSuccess).toHaveBeenCalled();
    expect(clearCheckpoint).toHaveBeenCalledWith('session1:msg1');
  });

  it('throws after all retries fail', async () => {
    callProviderMock.mockImplementation(() => { throw new Error('rate limit exceeded'); });

    const p = ErrorHandlingService.handleErrors(
      new Error('rate limit exceeded'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
    );
    // Register a no-op handler so Node doesn't flag an unhandled rejection
    // during timer advancement — the real assertion still uses p below.
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).rejects.toThrow('openai failed: rate limit exceeded');
  }, 10000);

  it('does not retry the same provider for auth errors, but still attempts fallback', async () => {
    callProviderMock.mockRejectedValue(new Error('invalid api key'));

    await expect(
      ErrorHandlingService.handleErrors(
        new Error('invalid api key'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
      ),
    ).rejects.toThrow('invalid api key');

    // Retrying the exact same provider+model against an invalid key can
    // never succeed -- callProviderMock should only have been invoked while
    // probing for a same-provider fallback MODEL (mocked to return null
    // above) or a different provider (none configured in this test), never
    // as a same-provider+model retry like the rate-limit case does.
    expect(callProviderMock).not.toHaveBeenCalledWith(baseReq, 'openai');
  });

  it('retries on 502 server errors', async () => {
    callProviderMock
      .mockRejectedValueOnce(new Error('502 Bad Gateway'))
      .mockResolvedValueOnce({ text: 'ok after 502' });

    const promise = ErrorHandlingService.handleErrors(
      new Error('502 Bad Gateway'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
    );
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result.res).toEqual({ text: 'ok after 502' });
  });

  it('falls back to a different connected provider on an auth error', async () => {
    providersConfigValue.gemini = { apiKey: 'key-123', enabled: true, model: 'gemini-2.5-pro' };
    activeProvidersValue = [{ id: 'gemini', config: { model: 'gemini-2.5-pro' } }];
    callProviderMock.mockRejectedValue(new Error('invalid api key'));
    // Only the fallback provider call succeeds -- verified by asserting the
    // call args below, not by call order, since mockRejectedValue applies
    // to every call by default.
    callProviderMock.mockImplementation((req: unknown, providerId?: string) =>
      providerId === 'gemini' ? Promise.resolve({ text: 'from gemini' }) : Promise.reject(new Error('invalid api key')),
    );

    const result = await ErrorHandlingService.handleErrors(
      new Error('invalid api key'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
    );

    expect(result.res).toEqual({ text: 'from gemini' });
    expect(callProviderMock).toHaveBeenCalledWith(baseReq, 'gemini');
    expect(addNotificationMock).toHaveBeenCalledWith(expect.stringContaining('Falling back to gemini'));
  });

  it('respects smartFallback disabled', async () => {
    smartFallbackValue = false;

    await expect(
      ErrorHandlingService.handleErrors(
        new Error('rate limit'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
      ),
    ).rejects.toThrow('rate limit');
  });
});
