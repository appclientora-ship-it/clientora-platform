import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, tenants, tenantMembers, subscriptionPlans, tenantSubscriptions, subscriptionEvents } from "../drizzle/schema";

export async function createOwnerWorkspaceWithPlan(
  userId: number,
  input: { name: string; slug: string; city?: string; countryCode: string; currency: string; timezone: string; planKey: string },
) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  try {
    return await db.transaction(async (tx) => {
      const account = (await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update").limit(1))[0];
      if (!account) throw new Error("الحساب غير موجود");
      const existingMembership = (await tx.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.userId, userId)).limit(1))[0];
      if (existingMembership) throw new Error("هذا الحساب مرتبط بمساحة عمل بالفعل");
      const plan = (await tx.select({ id: subscriptionPlans.id, planKey: subscriptionPlans.planKey })
        .from(subscriptionPlans).where(and(eq(subscriptionPlans.planKey, input.planKey), eq(subscriptionPlans.active, 1))).limit(1))[0];
      if (!plan) throw new Error("الباقة المحددة غير متاحة؛ حدّث الصفحة واختر باقة أخرى");
      const slug = input.slug.toLowerCase();
      const existingSlug = (await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1))[0];
      if (existingSlug) throw new Error("رابط مساحة العمل مستخدم بالفعل، اختر رابطاً آخر");
      const inserted = await tx.insert(tenants).values({
        name: input.name.trim(), slug, city: input.city?.trim() || null,
        countryCode: input.countryCode, currency: input.currency, timezone: input.timezone,
        status: "trial",
      });
      const tenantId = Number(inserted[0].insertId);
      await tx.insert(tenantMembers).values({ tenantId, userId, role: "owner" });
      await tx.insert(tenantSubscriptions).values({ tenantId, planId: plan.id, status: "pending", graceDays: 21, autoRenew: 0 });
      await tx.insert(subscriptionEvents).values({
        tenantId, actorUserId: userId, action: "subscription.plan_selected",
        details: JSON.stringify({ planKey: plan.planKey, source: "owner_onboarding" }),
      });
      return (await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1))[0];
    });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) throw new Error("رابط مساحة العمل مستخدم بالفعل، اختر رابطاً آخر");
    throw error;
  }
}

export async function getOwnerOnboardingPlans() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  return db.select({
    planKey: subscriptionPlans.planKey,
    staffLimit: subscriptionPlans.staffLimit,
    monthlyPriceCents: subscriptionPlans.monthlyPriceCents,
    currency: subscriptionPlans.currency,
  }).from(subscriptionPlans).where(eq(subscriptionPlans.active, 1)).orderBy(asc(subscriptionPlans.monthlyPriceCents));
}
