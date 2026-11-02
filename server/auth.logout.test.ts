import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { localSessionCookie } from "./localAuth";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "local:sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "password",
    passwordHash: "must-never-reach-the-client",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { secure: true, protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the Clientora session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0].name).toBe(localSessionCookie);
    expect(clearedCookies[0].options).toMatchObject({
      maxAge: 0,
      secure: true,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth.me", () => {
  it("returns the authenticated user without the password hash", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).toMatchObject({
      id: 1,
      email: "sample@example.com",
      role: "user",
    });
  });

  it("returns null when there is no authenticated user", async () => {
    const { ctx } = createAuthContext();
    ctx.user = null;
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.me()).resolves.toBeNull();
  });
});
