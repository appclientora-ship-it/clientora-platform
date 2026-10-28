import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createExpense, createPublicBooking, createTenantForUser, getEmployeeReports, getPublicBookingCatalog, getTenantForUser, listBookings, listDetailedBookings, listExpenses, listNotifications, listTenants, setTenantStatus, updateBookingForTenant, userCanAccessTenant } from "./db";
import { localSessionCookie, loginLocalUser, registerLocalUser, requestPasswordReset, resetPassword, sessionForUser } from "./localAuth";

export const appRouter = router({
  system: router({ health: publicProcedure.query(() => ({ ok: true })) }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); ctx.res.clearCookie(localSessionCookie, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
    register: publicProcedure.input(z.object({name:z.string().min(2).max(160),email:z.string().email(),password:z.string().min(8).max(128)})).mutation(async ({ctx,input}) => { try { const user=await registerLocalUser(input); ctx.res.cookie(localSessionCookie,sessionForUser(user.id),{...getSessionCookieOptions(ctx.req),maxAge:30*24*60*60*1000}); return user; } catch(error) { throw new TRPCError({code:"BAD_REQUEST",message:error instanceof Error?error.message:"تعذر إنشاء الحساب"}); } }),
    login: publicProcedure.input(z.object({email:z.string().email(),password:z.string().min(1).max(128)})).mutation(async ({ctx,input}) => { try { const user=await loginLocalUser(input.email,input.password); ctx.res.cookie(localSessionCookie,sessionForUser(user.id),{...getSessionCookieOptions(ctx.req),maxAge:30*24*60*60*1000}); return user; } catch(error) { throw new TRPCError({code:"UNAUTHORIZED",message:error instanceof Error?error.message:"تعذر تسجيل الدخول"}); } }),
    forgotPassword: publicProcedure.input(z.object({email:z.string().email()})).mutation(({input}) => requestPasswordReset(input.email)),
    resetPassword: publicProcedure.input(z.object({token:z.string().min(20),password:z.string().min(8).max(128)})).mutation(async ({input}) => { try { return await resetPassword(input.token,input.password); } catch(error) { throw new TRPCError({code:"BAD_REQUEST",message:error instanceof Error?error.message:"تعذر تغيير كلمة المرور"}); } }),
  }),
  platform: router({
    tenants: adminProcedure.query(() => listTenants()),
    setTenantStatus: adminProcedure.input(z.object({tenantId:z.number(),status:z.enum(["active","trial","suspended"])})).mutation(({ctx,input}) => setTenantStatus(input.tenantId,input.status,ctx.user.id)),
  }),
  publicBooking: router({
    catalog: publicProcedure.input(z.object({ slug: z.string().min(2) })).query(({ input }) => getPublicBookingCatalog(input.slug)),
    create: publicProcedure.input(z.object({ slug:z.string().min(2), clientName:z.string().min(2), phone:z.string().min(5), serviceId:z.number().int().positive(), serviceIds:z.array(z.number().int().positive()).min(1).optional(), staffId:z.number().int().positive(), date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startMinutes:z.number().int().min(0).max(1439), note:z.string().max(500).optional() })).mutation(async ({ input }) => {
      try { return await createPublicBooking(input); } catch (error) { throw new TRPCError({ code:"BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إنشاء الحجز" }); }
    }),
  }),
  workspace: router({
    current: protectedProcedure.query(({ ctx }) => getTenantForUser(ctx.user)),
    createTenant: protectedProcedure.input(z.object({name:z.string().min(2).max(160), slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(120), city:z.string().max(120).optional(), currency:z.string().max(12).optional()})).mutation(async ({ctx,input}) => {
      try { return await createTenantForUser(ctx.user.id, input); } catch (error) { throw new TRPCError({code:"BAD_REQUEST",message:error instanceof Error ? error.message : "تعذر إنشاء مساحة الشركة"}); }
    }),
    bookings: protectedProcedure.input(z.object({ tenantId: z.number(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(async ({ ctx, input }) => {
      if (!(await userCanAccessTenant(ctx.user, input.tenantId))) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية الوصول إلى هذه الشركة" });
      return listDetailedBookings(input.tenantId, input.date);
    }),
    updateBooking: protectedProcedure.input(z.object({tenantId:z.number(),bookingId:z.number(),status:z.enum(["new","confirmed","arrived","cancelled","no_show"]).optional(),paid:z.boolean().optional(),note:z.string().max(500).optional(),durationMinutes:z.number().int().min(15).max(480).optional(),staffId:z.number().int().positive().optional(),startMinutes:z.number().int().min(0).max(1439).optional(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()})).mutation(async ({ctx,input}) => {
      if (!(await userCanAccessTenant(ctx.user,input.tenantId))) throw new TRPCError({code:"FORBIDDEN",message:"لا تملك صلاحية الوصول إلى هذه الشركة"});
      try { const {tenantId,bookingId,...patch} = input; return await updateBookingForTenant(tenantId,bookingId,patch,ctx.user.id); } catch (error) { throw new TRPCError({code:"BAD_REQUEST",message:error instanceof Error ? error.message : "تعذر تحديث الحجز"}); }
    }),
    notifications: protectedProcedure.input(z.object({tenantId:z.number()})).query(async ({ctx,input}) => { if (!(await userCanAccessTenant(ctx.user,input.tenantId))) throw new TRPCError({code:"FORBIDDEN",message:"لا تملك صلاحية الوصول إلى هذه الشركة"}); return listNotifications(input.tenantId); }),
    reports: protectedProcedure.input(z.object({tenantId:z.number(),fromDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),toDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)})).query(async ({ctx,input}) => { if (!(await userCanAccessTenant(ctx.user,input.tenantId))) throw new TRPCError({code:"FORBIDDEN",message:"لا تملك صلاحية الوصول إلى هذه الشركة"}); return getEmployeeReports(input.tenantId,input.fromDate,input.toDate); }),
    expenses: protectedProcedure.input(z.object({tenantId:z.number(),fromDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),toDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)})).query(async ({ctx,input}) => { if (!(await userCanAccessTenant(ctx.user,input.tenantId))) throw new TRPCError({code:"FORBIDDEN",message:"لا تملك صلاحية الوصول إلى هذه الشركة"}); return listExpenses(input.tenantId,input.fromDate,input.toDate); }),
    addExpense: protectedProcedure.input(z.object({tenantId:z.number(),category:z.string().min(2).max(100),description:z.string().min(2).max(240),vendor:z.string().max(160).optional(),amount:z.number().int().positive(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),paymentMethod:z.string().min(2).max(40)})).mutation(async ({ctx,input}) => { if (!(await userCanAccessTenant(ctx.user,input.tenantId))) throw new TRPCError({code:"FORBIDDEN",message:"لا تملك صلاحية الوصول إلى هذه الشركة"}); const {tenantId,...expense}=input; return createExpense(tenantId,ctx.user.id,expense); }),
  }),
});
export type AppRouter = typeof appRouter;
