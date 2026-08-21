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
  },
}));

vi.mock('../brain/ResilientRelay', () => ({
  isRateLimitOrQuotaError: (msg: string) => /rate.?limit|quota|429|402/.test(msg),
  isRetryableServerError: (msg: string) => /502|503|504|timeout/.test(msg),
  saveCheckpoint: vi.fn(),
  clearCheckpoint: vi.fn(),
}));

vi.mock('../brain/network', () => ({
  friendlyError: (provider: string, err: Error) => `${provider} failed: ${err.message}`,
}));

import ErrorHandlingService from '../ErrorHandlingService';
import ProviderMonitor from '../ProviderMonitor';
import { saveCheckpoint, clearCheckpoint } from '../brain/ResilientRelay';

describe('ErrorHandlingService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    smartFallbackValue = true;
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
    callProviderMock.mockRejectedValue(new Error('rate limit exceeded'));

    const promise = ErrorHandlingService.handleErrors(
      new Error('rate limit exceeded'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
    ).catch(e => { throw e; });

    await vi.advanceTimersByTimeAsync(10000);
    await expect(promise).rejects.toThrow();
  }, 15000);

  it('does not retry non-rate-limit errors', async () => {
    callProviderMock.mockRejectedValue(new Error('invalid api key'));

    await expect(
      ErrorHandlingService.handleErrors(
        new Error('invalid api key'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
      ),
    ).rejects.toThrow('invalid api key');
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

  it('respects smartFallback disabled', async () => {
    smartFallbackValue = false;

    await expect(
      ErrorHandlingService.handleErrors(
        new Error('rate limit'), baseReq, 'openai', 'gpt-4o', performance.now(), '', 1, [],
      ),
    ).rejects.toThrow('rate limit');
  });
});
