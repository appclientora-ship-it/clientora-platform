type WindowEntry = { count: number; resetAt: number };

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, WindowEntry>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
      throw new Error("Rate limit configuration must be positive");
    }
  }

  consume(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const currentTime = this.now();
    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + this.windowMs };
      this.entries.set(key, entry);
    }

    if (entry.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000)),
      };
    }

    entry.count += 1;
    if (this.entries.size > 10_000) {
      for (const [entryKey, value] of this.entries) {
        if (value.resetAt <= currentTime) this.entries.delete(entryKey);
      }
    }

    return {
      allowed: true,
      remaining: this.limit - entry.count,
      retryAfterSeconds: 0,
    };
  }
}
