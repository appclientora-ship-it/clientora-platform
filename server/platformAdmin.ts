import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { platformAdminAuditLogs, platformAdminBootstrap } from "../drizzle/platformSecuritySchema";
import { users } from "../drizzle/schema";

type AuditContext = { ip?: string | null; userAgent?: string | null; reason?: string | null };

function requireBootstrapSecret(): void {
  const configured = process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN;
  if (!configured || Buffer.byteLength(configured, "utf8") < 32) {
    throw new Error("SUPER_ADMIN_BOOTSTRAP_TOKEN must be configured with at least 32 characters for the one-time server-side bootstrap");
  }
}

/**
 * Run only from the trusted server CLI. This is intentionally not an HTTP route.
 * Possession of the server-only bootstrap secret and an explicit local account ID
 * are both required; email addresses are never used to identify or promote an admin.
 */
export async function bootstrapFirstSuperAdmin(userId: number) {
  requireBootstrapSecret();
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("A valid local user ID is required");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db.transaction(async (tx) => {
    const state = (await tx.select().from(platformAdminBootstrap)
      .where(eq(platformAdminBootstrap.id, 1)).for("update").limit(1))[0];
    if (!state) throw new Error("Platform bootstrap state is missing; apply the platform security migration first");
    if (state.claimedAt) throw new Error("The first Super Admin has already been initialized");

    const target = (await tx.select().from(users).where(eq(users.id, userId)).for("update").limit(1))[0];
    const ownerEmail = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
    if (!ownerEmail || !target?.email || target.email.trim().toLowerCase() !== ownerEmail) {
      throw new Error("Bootstrap target email must match the configured PLATFORM_OWNER_EMAIL");
    }
    if (!target.emailVerifiedAt) throw new Error("Platform owner email must be verified before Super Admin bootstrap");
    if (!target || !target.passwordHash || !target.openId.startsWith("local:")) {
      throw new Error("Bootstrap target must be an existing local-password account selected by numeric user ID");
    }
    const existingAdmins = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    if (existingAdmins.length > 0 && target.role !== "admin") {
      throw new Error("A platform administrator already exists; use the audited admin management flow");
    }

    const now = new Date();
    if (target.role !== "admin") {
      await tx.update(users).set({ role: "admin" }).where(and(eq(users.id, userId), eq(users.role, "user")));
    }
    await tx.update(platformAdminBootstrap).set({ claimedAt: now, claimedByUserId: userId })
      .where(and(eq(platformAdminBootstrap.id, 1), sql`claimedAt IS NULL`));
    await tx.insert(platformAdminAuditLogs).values({
      actorUserId: null,
      targetUserId: userId,
      action: "bootstrap.completed",
      previousRole: target.role,
      newRole: "admin",
      reason: "One-time server-side Super Admin bootstrap",
    });
    return { success: true as const, userId, role: "admin" as const };
  });
}

export async function setPlatformAdminRole(
  actorUserId: number,
  targetUserId: number,
  enabled: boolean,
  audit: AuditContext = {},
) {
  if (!Number.isSafeInteger(targetUserId) || targetUserId < 1) throw new Error("Invalid target user ID");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db.transaction(async (tx) => {
    const state = (await tx.select().from(platformAdminBootstrap)
      .where(eq(platformAdminBootstrap.id, 1)).for("update").limit(1))[0];
    if (!state?.claimedAt) throw new Error("Platform Super Admin bootstrap has not been completed");

    const actor = (await tx.select().from(users).where(eq(users.id, actorUserId)).for("update").limit(1))[0];
    if (!actor || actor.role !== "admin") throw new Error("Only an active Super Admin may change platform privileges");
    const target = (await tx.select().from(users).where(eq(users.id, targetUserId)).for("update").limit(1))[0];
    if (!target) throw new Error("Target user does not exist");

    const nextRole = enabled ? "admin" : "user";
    if (target.role === nextRole) return { success: true as const, changed: false as const, role: nextRole };

    if (!enabled) {
      const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      if (admins.length <= 1) throw new Error("Cannot revoke the last remaining Super Admin");
    }

    await tx.update(users).set({ role: nextRole }).where(eq(users.id, targetUserId));
    await tx.insert(platformAdminAuditLogs).values({
      actorUserId,
      targetUserId,
      action: enabled ? "super_admin.granted" : "super_admin.revoked",
      previousRole: target.role,
      newRole: nextRole,
      reason: audit.reason?.trim().slice(0, 500) || null,
      actorIp: audit.ip?.slice(0, 64) || null,
      actorUserAgent: audit.userAgent?.slice(0, 500) || null,
    });
    return { success: true as const, changed: true as const, role: nextRole };
  });
}

export async function listPlatformAdminAuditLogs() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(platformAdminAuditLogs).orderBy(desc(platformAdminAuditLogs.createdAt)).limit(100);
}
