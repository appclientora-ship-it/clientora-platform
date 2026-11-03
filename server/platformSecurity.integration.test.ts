import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bootstrapFirstSuperAdmin, setPlatformAdminRole } from "./platformAdmin";
import { registerLocalUser, loginLocalUser, createEmailVerificationToken, verifyEmailToken, resendEmailVerification } from "./localAuth";
import { createTenantForUser, upsertUser } from "./db";
import { consumeSharedRateLimit } from "./_core/rateLimit";
import { createContext } from "./_core/context";
import { sessionForUser } from "./localAuth";

const databaseUrl = process.env.DATABASE_URL;
let safeTestDatabase = false;
try {
  const parsed = new URL(databaseUrl || "");
  safeTestDatabase = process.env.RUN_MYSQL_INTEGRATION === "1"
    && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
    && parsed.pathname.replace(/^\//, "") === "clientora_test";
} catch { /* skip unless an isolated local test database is configured */ }

describe.skipIf(!safeTestDatabase)("platform security integration (isolated MySQL only)", () => {
  const secret = "test-only-super-admin-bootstrap-secret-32-bytes-minimum";
  const createdUserIds: number[] = [];
  const createdTenantIds: number[] = [];
  const rateKeys: string[] = [];
  let connection: mysql.Connection;

  beforeAll(async () => {
    process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN = secret;
    process.env.AUTH_SESSION_SECRET = "test-only-auth-session-secret-at-least-32-characters";
    connection = await mysql.createConnection(databaseUrl!);
  });

  afterEach(async () => {
    if (connection) {
      await connection.execute("UPDATE platformAdminBootstrap SET claimedAt = NULL, claimedByUserId = NULL WHERE id = 1");
      for (const id of createdUserIds) await connection.execute("UPDATE users SET role = 'user' WHERE id = ?", [id]);
    }
  });

  afterAll(async () => {
    if (connection) {
      if (createdUserIds.length) {
        const placeholders = createdUserIds.map(() => "?").join(",");
        await connection.execute(
          `DELETE FROM platformAdminAuditLogs WHERE targetUserId IN (${placeholders}) OR actorUserId IN (${placeholders})`,
          [...createdUserIds, ...createdUserIds],
        );
      }
      for (const id of createdTenantIds) await connection.execute("DELETE FROM staffInvites WHERE tenantId = ?", [id]);
      for (const id of createdTenantIds) await connection.execute("DELETE FROM staff WHERE tenantId = ?", [id]);
      for (const id of createdTenantIds) await connection.execute("DELETE FROM tenantMembers WHERE tenantId = ?", [id]);
      for (const id of createdTenantIds) await connection.execute("DELETE FROM tenants WHERE id = ?", [id]);
      for (const id of createdUserIds) await connection.execute("DELETE FROM emailVerifications WHERE userId = ?", [id]);
      for (const id of createdUserIds) await connection.execute("DELETE FROM users WHERE id = ?", [id]);
      for (const key of rateKeys) {
        const hash = createHash("sha256").update(key).digest("hex");
        await connection.execute("DELETE FROM rateLimitBuckets WHERE bucketKey = ?", [hash]);
      }
      await connection.execute("UPDATE platformAdminBootstrap SET claimedAt = NULL, claimedByUserId = NULL WHERE id = 1");
      await connection.end();
    }
    delete process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN;
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.PLATFORM_OWNER_EMAIL;
  });

  async function newUser(label: string) {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 16);
    const user = await registerLocalUser({
      name: label,
      email: `${label.toLowerCase().replace(/[^a-z]/g, "")}-${suffix}@clientora.test`,
      password: "Integration-test-password-123",
    });
    createdUserIds.push(user.id);
    await connection.execute("UPDATE users SET emailVerifiedAt = NOW(3) WHERE id = ?", [user.id]);
    return { ...user, emailVerifiedAt: new Date() };
  }

  it("verifies email with a hashed, expiring, single-use token before login", async () => {
    const user = await registerLocalUser({ name: "Email Verify", email: `verify-${randomUUID()}@clientora.test`, password: "Integration-test-password-123" });
    createdUserIds.push(user.id);
    await expect(loginLocalUser(user.email!, "Integration-test-password-123")).rejects.toThrow("تأكيد بريدك الإلكتروني");
    const token = await createEmailVerificationToken(user.id);
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT tokenHash, expiresAt, usedAt FROM emailVerifications WHERE userId = ? ORDER BY id DESC LIMIT 1", [user.id]);
    expect(rows[0]?.tokenHash).not.toBe(token);
    await expect(verifyEmailToken(token)).resolves.toMatchObject({ success: true });
    await expect(verifyEmailToken(token)).rejects.toThrow("غير صالح أو منتهي");
    expect((await loginLocalUser(user.email!, "Integration-test-password-123")).id).toBe(user.id);
  });

  it("limits verification resends to three requests per normalized inbox per hour", async () => {
    const email = "resend-" + randomUUID() + "@clientora.test";
    const key = "auth.email-verification-resend:" + email;
    rateKeys.push(key);
    await expect(resendEmailVerification(email)).resolves.toMatchObject({ message: expect.any(String) });
    await expect(resendEmailVerification(email)).resolves.toMatchObject({ message: expect.any(String) });
    await expect(resendEmailVerification(email)).resolves.toMatchObject({ message: expect.any(String) });
    await expect(resendEmailVerification(email)).rejects.toThrow("رسائل تفعيل كثيرة");
  });
  it("rejects an expired email verification token", async () => {
    const user = await registerLocalUser({ name: "Expired Verify", email: `expired-${randomUUID()}@clientora.test`, password: "Integration-test-password-123" });
    createdUserIds.push(user.id);
    const token = await createEmailVerificationToken(user.id);
    await connection.execute("UPDATE emailVerifications SET expiresAt = DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE userId = ?", [user.id]);
    await expect(verifyEmailToken(token)).rejects.toThrow("غير صالح أو منتهي");
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT emailVerifiedAt FROM users WHERE id = ?", [user.id]);
    expect(rows[0]?.emailVerifiedAt).toBeNull();
  });

  it("rejects Super Admin bootstrap when the configured owner email does not match", async () => {
    const user = await newUser("Wrong Owner Email");
    process.env.PLATFORM_OWNER_EMAIL = "different-owner@clientora.test";
    await expect(bootstrapFirstSuperAdmin(user.id)).rejects.toThrow("PLATFORM_OWNER_EMAIL");
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [user.id]);
    expect(rows[0]?.role).toBe("user");
  });

  it("keeps registration and login functional and rejects duplicate email registration", async () => {
    const email = `login-${randomUUID()}@clientora.test`;
    const user = await registerLocalUser({ name: "Login Test", email, password: "Integration-test-password-123" });
    createdUserIds.push(user.id);
    await connection.execute("UPDATE users SET emailVerifiedAt = NOW(3) WHERE id = ?", [user.id]);
    expect((await loginLocalUser(email.toUpperCase(), "Integration-test-password-123")).id).toBe(user.id);
    await expect(registerLocalUser({ name: "Duplicate", email, password: "Another-password-123" })).rejects.toThrow("هذا البريد مسجل بالفعل");
  });

  it("rejects staff invitation redemption when the tenant is suspended", async () => {
    const slug = `suspended-invite-${randomUUID().slice(0, 8)}`;
    const [tenantResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO tenants (name, slug, status, currency) VALUES (?, ?, 'suspended', 'OMR')",
      ["Suspended Invitation Tenant", slug],
    );
    const tenantId = Number(tenantResult.insertId);
    createdTenantIds.push(tenantId);
    const [staffResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO staff (tenantId, name, role, active) VALUES (?, ?, ?, 1)",
      [tenantId, "Invited Staff", "Barber"],
    );
    const staffId = Number(staffResult.insertId);
    const code = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    await connection.execute(
      "INSERT INTO staffInvites (tenantId, staffId, email, code, role, expiresAt, createdByUserId) VALUES (?, ?, NULL, ?, 'staff', DATE_ADD(NOW(3), INTERVAL 1 DAY), 1)",
      [tenantId, staffId, code],
    );
    const email = `suspended-${randomUUID()}@clientora.test`;
    await expect(registerLocalUser({
      name: "Suspended Invite",
      email,
      password: "Integration-test-password-123",
      inviteCode: code,
    })).rejects.toThrow("كود الدعوة غير صالح أو منتهي");
    const [usersFound] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    expect(usersFound).toHaveLength(0);
    const [staffRows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT userId FROM staff WHERE id = ?",
      [staffId],
    );
    expect(staffRows[0]?.userId).toBeNull();
  });

  it("prevents staff and managers from creating a separate owner workspace", async () => {
    for (const role of ["staff", "manager"] as const) {
      const user = await newUser(`Existing ${role}`);
      const slug = `membership-${role}-${randomUUID().slice(0, 8)}`;
      const [tenantResult] = await connection.execute<mysql.ResultSetHeader>(
        "INSERT INTO tenants (name, slug, status, currency) VALUES (?, ?, 'trial', 'OMR')",
        [`Membership ${role}`, slug],
      );
      const tenantId = Number(tenantResult.insertId);
      createdTenantIds.push(tenantId);
      await connection.execute(
        "INSERT INTO tenantMembers (tenantId, userId, role) VALUES (?, ?, ?)",
        [tenantId, user.id, role],
      );
      await expect(createTenantForUser(user.id, {
        name: "Unauthorized Owner Workspace",
        slug: `unauthorized-${role}-${randomUUID().slice(0, 8)}`,
      })).rejects.toThrow("مرتبط بشركة بالفعل");
      const [owned] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT id FROM tenantMembers WHERE userId = ? AND role = 'owner'",
        [user.id],
      );
      expect(owned).toHaveLength(0);
    }
  });

  it("does not promote users through profile synchronization, even if the legacy owner variable is set", async () => {
    const user = await newUser("Regular User");
    process.env.OWNER_OPEN_ID = user.openId;
    await upsertUser({ openId: user.openId, name: user.name, email: user.email });
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [user.id]);
    expect(rows[0]?.role).toBe("user");
    delete process.env.OWNER_OPEN_ID;
  });

  it("does not treat a legacy account as email-verified for owner bootstrap", async () => {
    const user = await newUser("Legacy Owner");
    process.env.PLATFORM_OWNER_EMAIL = user.email!;
    await connection.execute("UPDATE users SET emailVerifiedAt = NULL, emailVerificationRequired = 0 WHERE id = ?", [user.id]);
    await expect(bootstrapFirstSuperAdmin(user.id)).rejects.toThrow("email must be verified");
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [user.id]);
    expect(rows[0]?.role).toBe("user");
    await expect(loginLocalUser(user.email!, "Integration-test-password-123")).resolves.toMatchObject({ id: user.id });
  });

  it("bootstraps one explicit local account once, audits it, and rejects reuse", async () => {
    const user = await newUser("Bootstrap Admin");
    process.env.PLATFORM_OWNER_EMAIL = user.email!;
    await expect(bootstrapFirstSuperAdmin(user.id)).resolves.toMatchObject({ success: true, userId: user.id, role: "admin" });
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [user.id]);
    expect(rows[0]?.role).toBe("admin");
    await expect(bootstrapFirstSuperAdmin(user.id)).rejects.toThrow("already been initialized");
    const [logs] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT action, previousRole, newRole FROM platformAdminAuditLogs WHERE targetUserId = ?",
      [user.id],
    );
    expect(logs.some((row) => row.action === "bootstrap.completed" && row.previousRole === "user" && row.newRole === "admin")).toBe(true);
  });

  it("allows audited grants and revocations, blocks non-admin actors and protects the last admin", async () => {
    const first = await newUser("First Admin");
    const second = await newUser("Second Admin");
    process.env.PLATFORM_OWNER_EMAIL = first.email!;
    await bootstrapFirstSuperAdmin(first.id);
    await expect(setPlatformAdminRole(first.id, second.id, true, { reason: "Test grant", ip: "127.0.0.1", userAgent: "Vitest" }))
      .resolves.toMatchObject({ changed: true, role: "admin" });
    await expect(setPlatformAdminRole(second.id, first.id, false, { reason: "Test revoke" }))
      .resolves.toMatchObject({ changed: true, role: "user" });
    await expect(setPlatformAdminRole(first.id, second.id, false)).rejects.toThrow("Only an active Super Admin");
    await expect(setPlatformAdminRole(second.id, second.id, false)).rejects.toThrow("last remaining Super Admin");
    const [logs] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT action, actorUserId, targetUserId, reason, actorIp, actorUserAgent FROM platformAdminAuditLogs WHERE targetUserId IN (?, ?) ORDER BY id",
      [first.id, second.id],
    );
    expect(logs.some((row) => row.action === "super_admin.granted" && Number(row.actorUserId) === first.id && row.reason === "Test grant" && row.actorIp === "127.0.0.1")).toBe(true);
    expect(logs.some((row) => row.action === "super_admin.revoked" && Number(row.actorUserId) === second.id)).toBe(true);
  });

  it("reloads the account role for an existing session after Super Admin revocation", async () => {
    const first = await newUser("Revoked Admin");
    const second = await newUser("Active Admin");
    process.env.PLATFORM_OWNER_EMAIL = first.email!;
    await bootstrapFirstSuperAdmin(first.id);
    await setPlatformAdminRole(first.id, second.id, true, { reason: "Session revocation test" });
    const token = sessionForUser(first);
    await setPlatformAdminRole(second.id, first.id, false, { reason: "Revoke previous admin" });

    const context = await createContext({
      req: { headers: { cookie: `clientora_session=${token}` } } as any,
      res: {} as any,
    });
    expect(context.user?.id).toBe(first.id);
    expect(context.user?.role).toBe("user");
  });

  it("shares one rate-limit counter across independent callers", async () => {
    const key = `integration.shared.${randomUUID()}`;
    rateKeys.push(key);
    expect((await consumeSharedRateLimit(key, 2, 60_000)).allowed).toBe(true);
    expect((await consumeSharedRateLimit(key, 2, 60_000)).allowed).toBe(true);
    expect((await consumeSharedRateLimit(key, 2, 60_000)).allowed).toBe(false);
  });
});
