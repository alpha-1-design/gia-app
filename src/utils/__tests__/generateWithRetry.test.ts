import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRetryPrompt, generateWithRetry } from '../generateWithRetry';

describe('generateWithRetry', () => {
  afterEach(() => vi.useRealTimers());

  it('includes the validation failure and bounded prior output in a repair prompt', () => {
    expect(buildRetryPrompt('Make a plan', {
      attempt: 1,
      error: 'No actionable steps',
      previousResponse: '{"plan":[]}',
    })).toContain('No actionable steps');
    expect(buildRetryPrompt('Make a plan', {
      attempt: 1,
      error: 'No actionable steps',
      previousResponse: '{"plan":[]} ',
    })).toContain('{"plan":[]}');
    expect(buildRetryPrompt('Make a plan')).toBe('Make a plan');
  });

  it('retries with schema validation context and returns normalized data', async () => {
    vi.useFakeTimers();
    const generate = vi.fn(async (retry?: { error: string; previousResponse: string }) => {
      if (!retry) return { text: '{"steps":[]}' };
      expect(retry.error).toContain('step');
      expect(retry.previousResponse).toBe('{"steps":[]}');
      return { text: '{"steps":[{"title":"Research"}]}' };
    });

    const pending = generateWithRetry<{ steps: { title: string }[] }>(
      generate,
      {
        maxRetries: 1,
        transform: value => {
          const parsed = value as { steps?: { title: string }[] };
          if (!parsed.steps?.length) throw new Error('At least one step is required.');
          return parsed as { steps: { title: string }[] };
        },
      }
    );
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({
      data: { steps: [{ title: 'Research' }] },
      attempts: 2,
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
