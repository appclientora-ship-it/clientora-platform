import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bootstrapFirstSuperAdmin, setPlatformAdminRole } from "./platformAdmin";
import { registerLocalUser, loginLocalUser } from "./localAuth";
import { upsertUser } from "./db";
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
  const rateKeys: string[] = [];
  let connection: mysql.Connection;

  beforeAll(async () => {
    process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN = secret;
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
      for (const id of createdUserIds) await connection.execute("DELETE FROM users WHERE id = ?", [id]);
      for (const key of rateKeys) {
        const hash = createHash("sha256").update(key).digest("hex");
        await connection.execute("DELETE FROM rateLimitBuckets WHERE bucketKey = ?", [hash]);
      }
      await connection.execute("UPDATE platformAdminBootstrap SET claimedAt = NULL, claimedByUserId = NULL WHERE id = 1");
      await connection.end();
    }
    delete process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN;
  });

  async function newUser(label: string) {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 16);
    const user = await registerLocalUser({
      name: label,
      email: `${label.toLowerCase().replace(/[^a-z]/g, "")}-${suffix}@clientora.test`,
      password: "Integration-test-password-123",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("keeps registration and login functional and rejects duplicate email registration", async () => {
    const email = `login-${randomUUID()}@clientora.test`;
    const user = await registerLocalUser({ name: "Login Test", email, password: "Integration-test-password-123" });
    createdUserIds.push(user.id);
    expect((await loginLocalUser(email.toUpperCase(), "Integration-test-password-123")).id).toBe(user.id);
    await expect(registerLocalUser({ name: "Duplicate", email, password: "Another-password-123" })).rejects.toThrow("هذا البريد مسجل بالفعل");
  });

  it("does not promote users through profile synchronization, even if the legacy owner variable is set", async () => {
    const user = await newUser("Regular User");
    process.env.OWNER_OPEN_ID = user.openId;
    await upsertUser({ openId: user.openId, name: user.name, email: user.email });
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [user.id]);
    expect(rows[0]?.role).toBe("user");
    delete process.env.OWNER_OPEN_ID;
  });

  it("bootstraps one explicit local account once, audits it, and rejects reuse", async () => {
    const user = await newUser("Bootstrap Admin");
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
