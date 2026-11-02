import { describe, expect, it, vi } from "vitest";
import { InMemoryRateLimiter } from "./rateLimit";

describe("InMemoryRateLimiter", () => {
  it("allows requests up to the limit and rejects the next request", () => {
    const limiter = new InMemoryRateLimiter(2, 60_000, () => 1_000);
    expect(limiter.consume("client")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume("client")).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume("client")).toMatchObject({ allowed: false, retryAfterSeconds: 60 });
  });

  it("tracks keys independently", () => {
    const limiter = new InMemoryRateLimiter(1, 60_000, () => 1_000);
    expect(limiter.consume("one").allowed).toBe(true);
    expect(limiter.consume("two").allowed).toBe(true);
    expect(limiter.consume("one").allowed).toBe(false);
  });

  it("resets an expired window", () => {
    let now = 1_000;
    const limiter = new InMemoryRateLimiter(1, 1_000, () => now);
    expect(limiter.consume("client").allowed).toBe(true);
    now = 2_000;
    expect(limiter.consume("client")).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("rejects invalid configuration", () => {
    expect(() => new InMemoryRateLimiter(0, 1_000)).toThrow();
  });
});
