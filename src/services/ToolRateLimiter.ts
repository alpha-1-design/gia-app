interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class ToolRateLimiter {
  private buckets: Map<string, BucketState> = new Map();

  constructor(
    private capacity: number,
    private refillPerSecond: number,
  ) {}

  consume(key: string, tokens = 1): boolean {
    const now = Date.now();
    let state = this.buckets.get(key);
    if (!state) {
      state = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, state);
    }
    const elapsed = Math.max(0, now - state.lastRefill) / 1000;
    const refill = elapsed * this.refillPerSecond;
    state.tokens = Math.min(this.capacity, state.tokens + refill);
    state.lastRefill = now;

    if (state.tokens >= tokens) {
      state.tokens -= tokens;
      return true;
    }
    return false;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

// Global per-minute rate limiter: 30 tool calls per minute per tool type, burst up to 5
export const toolRateLimiter = new ToolRateLimiter(5, 30 / 60);
export const globalToolLimiter = new ToolRateLimiter(20, 120 / 60);
