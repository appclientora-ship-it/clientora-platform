import { createHash } from "node:crypto";
import { eq, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { rateLimitBuckets } from "../../drizzle/platformSecuritySchema";

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
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000)) };
    }
    entry.count += 1;
    if (this.entries.size > 10_000) {
      for (const [entryKey, value] of this.entries) if (value.resetAt <= currentTime) this.entries.delete(entryKey);
    }
    return { allowed: true, remaining: this.limit - entry.count, retryAfterSeconds: 0 };
  }
}

let lastCleanupAt = 0;

/**
 * Shared MySQL fixed-window limiter. The atomic upsert is the counter operation,
 * so all app instances use the same bucket. If storage is unavailable this
 * throws and the middleware fails closed rather than silently bypassing limits.
 */
export async function consumeSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error("Rate limit configuration must be positive");
  }
  const db = await getDb();
  if (!db) throw new Error("Shared rate-limit storage is unavailable");

  const bucketKey = createHash("sha256").update(key).digest("hex");
  const nextResetAt = new Date(now + windowMs);
  await db.insert(rateLimitBuckets).values({ bucketKey, count: 1, resetAt: nextResetAt }).onDuplicateKeyUpdate({
    set: {
      count: sql`IF(${rateLimitBuckets.resetAt} <= CURRENT_TIMESTAMP(3), 1, ${rateLimitBuckets.count} + 1)`,
      resetAt: sql`IF(${rateLimitBuckets.resetAt} <= CURRENT_TIMESTAMP(3), VALUES(${rateLimitBuckets.resetAt}), ${rateLimitBuckets.resetAt})`,
    },
  });

  const entry = (await db.select().from(rateLimitBuckets).where(eq(rateLimitBuckets.bucketKey, bucketKey)).limit(1))[0];
  if (!entry) throw new Error("Shared rate-limit bucket could not be read");
  const resetAt = new Date(entry.resetAt).getTime();
  if (now - lastCleanupAt >= 60_000) {
    lastCleanupAt = now;
    try {
      await db.delete(rateLimitBuckets).where(lte(rateLimitBuckets.resetAt, new Date(now)));
    } catch (error) {
      lastCleanupAt = 0;
      throw error;
    }
  }
  const allowed = entry.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}
