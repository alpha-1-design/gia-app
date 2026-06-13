import { extractJSON } from './helpers';
import { logger } from './logger';
import OutputValidator from '../services/OutputValidator';

const RETRY_DELAYS_MS = [1000, 3000, 6000, 10000];
const MAX_RETRIES = 4;

interface RetryOptions {
  maxRetries?: number;
  repairOutput?: boolean;
  moduleName?: string;
  onRetry?: (attempt: number, error: string) => void;
}

interface RetryResult<T> {
  data: T;
  attempts: number;
  wasRepaired: boolean;
}

export async function generateWithRetry<T>(
  generateFn: () => Promise<{ text: string }>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = MAX_RETRIES,
    repairOutput = true,
    moduleName = 'Module',
    onRetry,
  } = options;

  let lastError: Error | null = null;
  let wasRepaired = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // If network is down, wait and check again before retrying
    if (attempt > 0 && typeof navigator !== 'undefined' && !navigator.onLine) {
      logger.log(`[${moduleName}] Network offline — waiting before retry ${attempt + 1}`);
      for (let wait = 0; wait < 15; wait++) {
        await new Promise(r => setTimeout(r, 1000));
        if (navigator.onLine) break;
      }
      if (!navigator.onLine) {
        throw new Error('No internet connection available. Check your network and try again.');
      }
    }

    try {
      const res = await generateFn();
      let text = res.text;

      if (!text || text.trim().length === 0) {
        throw new Error('AI returned an empty response');
      }

      if (repairOutput) {
        const validated = OutputValidator.validate(text);
        if (validated.issues.length > 0) {
          wasRepaired = true;
          logger.log(`[${moduleName}] OutputValidator repaired:`, validated.issues);
          text = validated.sanitized;
        }
      }

      const parsed: T = extractJSON<T>(text);
      return { data: parsed, attempts: attempt + 1, wasRepaired };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.slice(0, 100);
      logger.warn(`[${moduleName}] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, msg);
      onRetry?.(attempt, msg);

      if (attempt < maxRetries) {
        const delay = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (isOffline) {
    throw new Error('No internet connection. Please check your network and try again.');
  }
  throw lastError || new Error(`The AI returned an invalid response for ${moduleName}. Please try again or switch to a different AI provider in Settings.`);
}
