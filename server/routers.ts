import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { addProduct, addService, addStaff, canAccessTenant, createPublicBooking, createStaffInvite, createTenant, createWorkspaceBooking, getPublicCatalog, getStaffPayroll, getTenantOperations, getTenantReports, joinTenantByInvite, listBookingsForTenant, listClientsForTenant, listProductsForTenant, listStaffInvites, listTenants, listTenantsForUser, sellProduct, submitPublicReview, updateBooking, updateStaff, updateTenantHours, updateTenantProfile } from "./db";
import { getDb } from "./db";
import { auditLogs, notifications, tenants } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

const tenantSlug = z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "استخدم حروفاً لاتينية صغيرة وأرقاماً وشرطات فقط");
const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ غير صحيحة");
function normalizeBookingSlug(value: string) {
  const raw = value.trim();
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const match = parsed.pathname.match(/\/book\/([^/]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]).toLowerCase();
  } catch { /* handled by schema validation below */ }
  return raw.replace(/^.*\/book\//i, "").replace(/^\/+|\/+$/g, "").toLowerCase();
}
function slugFromCompany(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || `company-${Date.now()}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  publicBooking: router({
    catalog: publicProcedure.input(z.object({ slug: tenantSlug })).query(({ input }) => getPublicCatalog(input.slug)),
    review: publicProcedure.input(z.object({ slug: tenantSlug, bookingId: z.number().int().positive(), phone: z.string().min(5).max(40), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })).mutation(async ({ input }) => {
      try { return await submitPublicReview(input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إرسال التقييم" }); }
    }),
    create: publicProcedure.input(z.object({
      slug: tenantSlug,
      clientName: z.string().min(2).max(160),
      phone: z.string().min(5).max(40),
      serviceIds: z.array(z.number().int().positive()).min(1),
      staffId: z.number().int().positive(),
      date: dateValue,
      startMinutes: z.number().int().min(0).max(1439),
      note: z.string().max(500).optional(),
    })).mutation(async ({ input }) => {
      try { return await createPublicBooking(input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إنشاء الحجز" }); }
    }),
  }),
  workspace: router({
    list: protectedProcedure.query(({ ctx }) => listTenantsForUser(ctx.user.id, ctx.user.role)),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(160), slug: z.string().max(500).optional(), websiteUrl: z.string().url().max(500).optional().or(z.literal("")), city: z.string().max(120).optional(), currency: z.string().max(12).optional() })).mutation(async ({ ctx, input }) => {
      try {
        const rawSlug = input.slug ?? "";
        const externalFromSlug = /^https?:\/\//i.test(rawSlug) && !/\/book\//i.test(rawSlug) ? rawSlug : undefined;
        const websiteUrl = input.websiteUrl || externalFromSlug;
        const entered = normalizeBookingSlug(rawSlug);
        const slug = !entered || entered.includes(".") || entered.includes("/") || entered.startsWith("http") ? slugFromCompany(input.name) : entered;
        return await createTenant(ctx.user.id, { ...input, slug, websiteUrl });
      }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إنشاء الشركة" }); }
    }),
    joinByInvite: protectedProcedure.input(z.object({ code: z.string().min(5).max(32) })).mutation(async ({ ctx, input }) => {
      try { return await joinTenantByInvite(ctx.user.id, input.code.trim()); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر الانضمام" }); }
    }),
    invites: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listStaffInvites(ctx.user.id, ctx.user.role, input.tenantId); }
      catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "لا تملك صلاحية لهذه الشركة" }); }
    }),
    createInvite: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), role: z.enum(["staff", "manager"]) })).mutation(async ({ ctx, input }) => {
      try { return await createStaffInvite(ctx.user.id, ctx.user.role, input.tenantId, input.role); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إنشاء الدعوة" }); }
    }),
    bookings: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), date: dateValue })).query(async ({ ctx, input }) => {
      if (!(await canAccessTenant(ctx.user.id, ctx.user.role, input.tenantId))) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية لهذه الشركة" });
      return listBookingsForTenant(input.tenantId, input.date);
    }),
    createBooking: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), clientName: z.string().min(2).max(160), phone: z.string().min(5).max(40), serviceId: z.number().int().positive(), staffId: z.number().int().positive(), date: dateValue, startMinutes: z.number().int().min(0).max(1439), note: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => {
      try { return await createWorkspaceBooking(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إنشاء الحجز" }); }
    }),
    operations: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await getTenantOperations(ctx.user.id, ctx.user.role, input.tenantId); }
      catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "لا تملك صلاحية لهذه الشركة" }); }
    }),
    addService: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(160), category: z.string().max(120).optional(), durationMinutes: z.number().int().min(15).max(480), price: z.number().int().min(0).max(1000000) })).mutation(async ({ ctx, input }) => {
      try { return await addService(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إضافة الخدمة" }); }
    }),
    addStaff: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(160), staffRole: z.string().max(120).optional() })).mutation(async ({ ctx, input }) => {
      try { return await addStaff(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إضافة الموظف" }); }
    }),
    updateStaff: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), staffId: z.number().int().positive(), name: z.string().min(2).max(160), staffRole: z.string().max(120), active: z.boolean(), commissionRate: z.number().int().min(0).max(100), commissionBasis: z.enum(["gross", "net"]) })).mutation(async ({ ctx, input }) => {
      try { return await updateStaff(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر تعديل الموظف" }); }
    }),
    clients: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listClientsForTenant(ctx.user.id, ctx.user.role, input.tenantId); }
      catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "لا تملك صلاحية لهذه الشركة" }); }
    }),
    products: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listProductsForTenant(ctx.user.id, ctx.user.role, input.tenantId); }
      catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "تعذر تحميل المنتجات" }); }
    }),
    addProduct: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(160), category: z.string().max(120).optional(), sku: z.string().max(80).optional(), salePrice: z.number().int().min(0), costPrice: z.number().int().min(0), stock: z.number().int().min(0), lowStockAt: z.number().int().min(0).max(100000) })).mutation(async ({ ctx, input }) => {
      try { return await addProduct(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إضافة المنتج" }); }
    }),
    sellProduct: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), productId: z.number().int().positive(), staffId: z.number().int().positive(), quantity: z.number().int().positive(), bookingId: z.number().int().positive().optional(), clientId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      try { return await sellProduct(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر تسجيل البيع" }); }
    }),
    payroll: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), from: dateValue, to: dateValue })).query(async ({ ctx, input }) => {
      try { return await getStaffPayroll(ctx.user.id, ctx.user.role, input.tenantId, input.from, input.to); }
      catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "تعذر تحميل كشف العمولات" }); }
    }),
    reports: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), from: dateValue, to: dateValue })).query(async ({ ctx, input }) => {
      try { return await getTenantReports(ctx.user.id, ctx.user.role, input.tenantId, input.from, input.to); }
      catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "تعذر تحميل التقارير" }); }
    }),
    updateHours: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), openMinutes: z.number().int().min(0).max(1439), closeMinutes: z.number().int().min(1).max(1440) })).mutation(async ({ ctx, input }) => {
      try { return await updateTenantHours(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر حفظ ساعات العمل" }); }
    }),
    updateProfile: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(160), slug: tenantSlug, city: z.string().max(120).optional(), phone: z.string().max(40).optional(), email: z.string().email().max(320).optional().or(z.literal("")), address: z.string().max(240).optional(), description: z.string().max(500).optional(), currency: z.string().min(1).max(12) })).mutation(async ({ ctx, input }) => {
      try { return await updateTenantProfile(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر حفظ بيانات الشركة" }); }
    }),
    updateBooking: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), bookingId: z.number().int().positive(), status: z.enum(["new", "confirmed", "arrived", "cancelled", "no_show"]).optional(), paid: z.boolean().optional(), note: z.string().max(500).optional(), staffId: z.number().int().positive().optional(), date: dateValue.optional(), startMinutes: z.number().int().min(0).max(1439).optional(), durationMinutes: z.number().int().min(15).max(480).optional() })).mutation(async ({ ctx, input }) => {
      try { return await updateBooking(ctx.user.id, ctx.user.role, input); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر تعديل الحجز" }); }
    }),
  }),
  platform: router({
    tenants: adminProcedure.query(() => listTenants()),
    setTenantStatus: adminProcedure.input(z.object({ tenantId: z.number().int().positive(), status: z.enum(["pending", "trial", "active", "suspended"]), subscriptionDays: z.number().int().min(1).max(1095).optional(), paymentReference: z.string().max(120).optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
      if ((input.status === "active" || input.status === "trial") && !input.subscriptionDays) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد مدة السماح أو الاشتراك قبل التفعيل" });
      const startsTimed = input.status === "active" || input.status === "trial";
      const startedAt = startsTimed ? new Date() : undefined;
      const endsAt = startsTimed && input.subscriptionDays ? new Date(Date.now() + input.subscriptionDays * 86400000) : undefined;
      await db.update(tenants).set({ status: input.status, subscriptionStartedAt: startedAt, subscriptionEndsAt: endsAt, paymentReference: input.paymentReference, paymentReceivedAt: input.status === "active" ? new Date() : undefined }).where(eq(tenants.id, input.tenantId));
      await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: `tenant.status.${input.status}`, entity: "tenant", entityId: input.tenantId });
      return { ok: true };
    }),
  }),
  notifications: router({
    list: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      if (!(await canAccessTenant(ctx.user.id, ctx.user.role, input.tenantId))) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية لهذه الشركة" });
      const db = await getDb(); if (!db) return [];
      return db.select().from(notifications).where(eq(notifications.tenantId, input.tenantId));
    }),
  }),
});

export type AppRouter = typeof appRouter;
