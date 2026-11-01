import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parse as parseCookieHeader } from "cookie";
import { findLocalUserById, localSessionCookie, userIdFromSession } from "../localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const token = parseCookieHeader(opts.req.headers.cookie ?? "")[localSessionCookie];
    const localId = userIdFromSession(token);
    if (localId) user = (await findLocalUserById(localId)) ?? null;
  } catch {
    // Authentication is optional for public procedures. Invalid or expired
    // local sessions must never block public booking endpoints.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
