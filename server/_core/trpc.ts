import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import { consumeSharedRateLimit } from "./rateLimit";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

function rateLimited(scope: string, limit: number, windowMs: number) {
  return t.middleware(async ({ ctx, next }) => {
    const ip = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
    // A database outage must not silently disable brute-force protection.
    const result = await consumeSharedRateLimit(scope + ":" + ip, limit, windowMs);
    if (!result.allowed) {
      ctx.res.setHeader("Retry-After", String(result.retryAfterSeconds));
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "طلبات كثيرة خلال وقت قصير. حاول مرة أخرى بعد قليل.",
      });
    }
    return next();
  });
}

const loginRateLimit = rateLimited("auth.login", 10, 15 * 60 * 1000);
const registrationRateLimit = rateLimited("auth.register", 5, 60 * 60 * 1000);
const passwordResetRateLimit = rateLimited("auth.password-reset", 5, 60 * 60 * 1000);
const publicBookingReadRateLimit = rateLimited("public-booking.read", 90, 60 * 1000);
const publicBookingCreateRateLimit = rateLimited("public-booking.create", 8, 60 * 1000);
const publicReviewRateLimit = rateLimited("public-booking.review", 5, 60 * 60 * 1000);

export const loginProcedure = publicProcedure.use(loginRateLimit);
export const registrationProcedure = publicProcedure.use(registrationRateLimit);
export const passwordResetProcedure = publicProcedure.use(passwordResetRateLimit);
export const publicBookingReadProcedure = publicProcedure.use(publicBookingReadRateLimit);
export const publicBookingCreateProcedure = publicProcedure.use(publicBookingCreateRateLimit);
export const publicReviewProcedure = publicProcedure.use(publicReviewRateLimit);


const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
