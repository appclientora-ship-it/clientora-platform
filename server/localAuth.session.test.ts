import { afterEach, describe, expect, it } from "vitest";
import { sessionForUser, sessionMatchesPasswordHash, userIdFromSession } from "./localAuth";

const previousSecret = process.env.AUTH_SESSION_SECRET;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
  else process.env.AUTH_SESSION_SECRET = previousSecret;
});

describe("password-bound sessions", () => {
  it("accepts a session only while the account password hash is unchanged", () => {
    process.env.AUTH_SESSION_SECRET = "test-session-secret-that-is-long-enough-123";
    const user = { id: 42, passwordHash: "salt:original-password-hash" };
    const token = sessionForUser(user);
    const session = userIdFromSession(token);

    expect(session?.userId).toBe(42);
    expect(session && sessionMatchesPasswordHash(session, user.passwordHash)).toBe(true);
    expect(session && sessionMatchesPasswordHash(session, "salt:new-password-hash")).toBe(false);
  });

  it("rejects malformed and tampered session tokens", () => {
    process.env.AUTH_SESSION_SECRET = "test-session-secret-that-is-long-enough-123";
    const token = sessionForUser({ id: 7, passwordHash: "salt:password-hash" });
    expect(userIdFromSession(token + "tampered")).toBeNull();
    expect(userIdFromSession("7.not-a-date.signature")).toBeNull();
  });
});
