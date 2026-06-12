import { extractJSON } from './helpers';
import { logger } from './logger';
import OutputValidator from '../services/OutputValidator';

const RETRY_DELAYS_MS = [500, 1500, 3000, 6000];
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
    try {
      const res = await generateFn();
      let text = res.text;

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
      logger.warn(`[${moduleName}] Parse attempt ${attempt + 1}/${maxRetries + 1} failed:`, msg);
      onRetry?.(attempt, msg);

      if (attempt < maxRetries) {
        const delay = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error(`[${moduleName}] Failed to parse JSON after ${maxRetries + 1} attempts`);
}
