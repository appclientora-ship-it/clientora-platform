import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { afterAll, describe, expect, it } from "vitest";
import { consumeTelegramLinkCode, createDashboardBooking, createPublicBooking, createTelegramLinkCode, listDetailedBookings } from "./db";

const databaseUrl = process.env.DATABASE_URL;
const integrationEnabled = process.env.RUN_MYSQL_INTEGRATION === "1" && Boolean(databaseUrl);

describe.skipIf(!integrationEnabled)("MySQL public booking concurrency", () => {
  const connectionPromise = mysql.createConnection(databaseUrl!);
  let tenantId = 0;
  const createdTenantIds: number[] = [];
  const telegramTestUsers: Array<{ userId: number; telegramUserId: string }> = [];
  let staffId = 0;
  let serviceId = 0;

  afterAll(async () => {
    const connection = await connectionPromise;
    for (const telegramTestUser of telegramTestUsers) {
      await connection.execute("DELETE FROM telegramLinks WHERE telegramUserId = ?", [telegramTestUser.telegramUserId]);
      await connection.execute("DELETE FROM telegramLinkTokens WHERE userId = ?", [telegramTestUser.userId]);
    }
    for (const cleanupTenantId of createdTenantIds) {
      await connection.execute("DELETE FROM notifications WHERE tenantId = ?", [cleanupTenantId]);
      await connection.execute("DELETE FROM auditLogs WHERE tenantId = ?", [cleanupTenantId]);
      await connection.execute("DELETE FROM bookingItems WHERE tenantId = ?", [cleanupTenantId]);
      await connection.execute("DELETE FROM bookings WHERE tenantId = ?", [cleanupTenantId]);
      await connection.execute("DELETE FROM clients WHERE tenantId = ?", [cleanupTenantId]);
      await connection.execute("DELETE FROM staffWorkingHours WHERE tenantId = ?", [cleanupTenantId]);
      await connection.execute("DELETE FROM services WHERE tenantId = ?", [cleanupTenantId]);
      await connection.execute("DELETE FROM staff WHERE tenantId = ?", [cleanupTenantId]);
      await connection.execute("DELETE FROM tenants WHERE id = ?", [cleanupTenantId]);
    }
    await connection.end();
  });

  it("allows only one of two simultaneous requests to reserve the same staff time", async () => {
    const connection = await connectionPromise;
    const unique = randomUUID().replace(/-/g, "").slice(0, 20);
    const slug = `concurrency-${unique}`;
    const phone = `+9689${unique.slice(0, 7)}`;
    const date = "2099-01-15";
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();

    const [tenantResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO tenants (name, slug, status, city, countryCode, currency, timezone, defaultLanguage) VALUES (?, ?, 'trial', 'Muscat', 'OM', 'OMR', 'Asia/Muscat', 'en')",
      ["Concurrency Test Salon", slug],
    );
    tenantId = tenantResult.insertId;
    createdTenantIds.push(tenantId);

    const [staffResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO staff (tenantId, name, role, active) VALUES (?, 'Test Stylist', 'Stylist', 1)",
      [tenantId],
    );
    staffId = staffResult.insertId;

    const [serviceResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO services (tenantId, name, category, durationMinutes, price, active) VALUES (?, 'Test Service', 'Test', 30, 1000, 1)",
      [tenantId],
    );
    serviceId = serviceResult.insertId;

    await connection.execute(
      "INSERT INTO staffWorkingHours (tenantId, staffId, weekday, openMinutes, closeMinutes, active) VALUES (?, ?, ?, 0, 1440, 1)",
      [tenantId, staffId, weekday],
    );

    const payload = {
      slug,
      clientName: "Concurrency Test Client",
      phone,
      serviceId,
      staffId,
      date,
      startMinutes: 600,
      idempotencyKey: randomUUID(),
    };

    const outcomes = await Promise.allSettled([
      createPublicBooking(payload),
      createPublicBooking({ ...payload, clientName: "Second Concurrent Client", phone: `${phone}2` }),
    ]);

    const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
    const rejected = outcomes.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);


    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM bookings WHERE tenantId = ? AND staffId = ? AND date = ? AND startMinutes = ? AND status <> 'cancelled'",
      [tenantId, staffId, date, 600],
    );
    expect(rows).toHaveLength(1);
  });

  it("returns the original booking for a repeated idempotency key", async () => {
    const connection = await connectionPromise;
    const unique = randomUUID().replace(/-/g, "").slice(0, 20);
    const slug = `retry-${unique}`;
    const phone = `+9688${unique.slice(0, 7)}`;
    const date = "2099-02-15";
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const [tenantResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO tenants (name, slug, status, city, countryCode, currency, timezone, defaultLanguage) VALUES (?, ?, 'trial', 'Muscat', 'OM', 'OMR', 'Asia/Muscat', 'en')",
      ["Idempotency Test Salon", slug],
    );
    const previousTenantId = tenantId;
    tenantId = tenantResult.insertId;
    createdTenantIds.push(tenantId);
    const [staffResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO staff (tenantId, name, role, active) VALUES (?, 'Test Stylist', 'Stylist', 1)", [tenantId],
    );
    staffId = staffResult.insertId;
    const [serviceResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO services (tenantId, name, category, durationMinutes, price, active) VALUES (?, 'Test Service', 'Test', 30, 1000, 1)", [tenantId],
    );
    serviceId = serviceResult.insertId;
    await connection.execute(
      "INSERT INTO staffWorkingHours (tenantId, staffId, weekday, openMinutes, closeMinutes, active) VALUES (?, ?, ?, 0, 1440, 1)",
      [tenantId, staffId, weekday],
    );
    const payload = { slug, clientName:"Retry Client", phone, serviceId, staffId, date, startMinutes:600, idempotencyKey:randomUUID() };
    const first = await createPublicBooking(payload);
    const retry = await createPublicBooking(payload);
    expect(retry).toEqual(first);
    await expect(createPublicBooking({ ...payload, clientName:"Different Client" })).rejects.toThrow("مفتاح الحجز مستخدم لبيانات مختلفة");
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM bookings WHERE tenantId = ? AND idempotencyKey = ?", [tenantId, payload.idempotencyKey],
    );
    expect(rows).toHaveLength(1);
    tenantId = previousTenantId;
  });


  it("retries Telegram account linking safely after the token was consumed", async () => {
    const connection = await connectionPromise;
    const unique = randomUUID().replace(/-/g, "").slice(0, 20);
    const userId = 1_000_000_000 + Number.parseInt(unique.slice(0, 7), 16);
    const telegramUserId = unique;
    telegramTestUsers.push({ userId, telegramUserId });

    const { code } = await createTelegramLinkCode(userId);
    const first = await consumeTelegramLinkCode(code, telegramUserId);
    const retry = await consumeTelegramLinkCode(code, telegramUserId);
    const otherTelegramAccount = await consumeTelegramLinkCode(code, `other-${telegramUserId}`);

    expect(first.success).toBe(true);
    expect(retry.success).toBe(true);
    expect(otherTelegramAccount.success).toBe(false);

    const [links] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM telegramLinks WHERE userId = ? AND telegramUserId = ? AND revokedAt IS NULL",
      [userId, telegramUserId],
    );
    expect(links).toHaveLength(1);
  });
  it("prevents a public booking and a dashboard booking from reserving the same staff time", async () => {
    const connection = await connectionPromise;
    const unique = randomUUID().replace(/-/g, "").slice(0, 20);
    const slug = `mixed-path-${unique}`;
    const phone = `+9687${unique.slice(0, 7)}`;
    const date = "2099-03-15";
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();

    const [tenantResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO tenants (name, slug, status, city, countryCode, currency, timezone, defaultLanguage) VALUES (?, ?, 'trial', 'Muscat', 'OM', 'OMR', 'Asia/Muscat', 'en')",
      ["Mixed Path Concurrency Test", slug],
    );
    tenantId = tenantResult.insertId;
    createdTenantIds.push(tenantId);

    const [staffResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO staff (tenantId, name, role, active) VALUES (?, 'Test Stylist', 'Stylist', 1)",
      [tenantId],
    );
    staffId = staffResult.insertId;

    const [serviceResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO services (tenantId, name, category, durationMinutes, price, active) VALUES (?, 'Test Service', 'Test', 30, 1000, 1)",
      [tenantId],
    );
    serviceId = serviceResult.insertId;

    await connection.execute(
      "INSERT INTO staffWorkingHours (tenantId, staffId, weekday, openMinutes, closeMinutes, active) VALUES (?, ?, ?, 0, 1440, 1)",
      [tenantId, staffId, weekday],
    );

    const outcomes = await Promise.allSettled([
      createPublicBooking({
        slug,
        clientName: "Online Client",
        phone,
        serviceId,
        staffId,
        date,
        startMinutes: 600,
        idempotencyKey: randomUUID(),
      }),
      createDashboardBooking(tenantId, 1, {
        clientName: "Dashboard Client",
        phone: `${phone}2`,
        serviceId,
        staffId,
        date,
        startMinutes: 600,
      }),
    ]);

    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);

    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM bookings WHERE tenantId = ? AND staffId = ? AND date = ? AND startMinutes = ? AND status <> 'cancelled'",
      [tenantId, staffId, date, 600],
    );
    expect(rows).toHaveLength(1);
  });

  it("does not return a tenant booking when its related client, service, and staff belong to another tenant", async () => {
    const connection = await connectionPromise;
    const unique = randomUUID().replace(/-/g, "").slice(0, 20);
    const [tenantAResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO tenants (name, slug, status, city, countryCode, currency, timezone, defaultLanguage) VALUES (?, ?, 'trial', 'Muscat', 'OM', 'OMR', 'Asia/Muscat', 'en')",
      ["Tenant A", `tenant-a-${unique}`],
    );
    const tenantA = tenantAResult.insertId;
    createdTenantIds.push(tenantA);
    const [tenantBResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO tenants (name, slug, status, city, countryCode, currency, timezone, defaultLanguage) VALUES (?, ?, 'trial', 'Muscat', 'OM', 'OMR', 'Asia/Muscat', 'en')",
      ["Tenant B", `tenant-b-${unique}`],
    );
    const tenantB = tenantBResult.insertId;
    createdTenantIds.push(tenantB);

    const [staffResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO staff (tenantId, name, role, active) VALUES (?, 'Foreign Staff', 'Stylist', 1)",
      [tenantB],
    );
    const [serviceResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO services (tenantId, name, category, durationMinutes, price, active) VALUES (?, 'Foreign Service', 'Test', 30, 1000, 1)",
      [tenantB],
    );
    const [clientResult] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO clients (tenantId, name, phone) VALUES (?, 'Foreign Client', '+96890000000')",
      [tenantB],
    );
    await connection.execute(
      "INSERT INTO bookings (tenantId, clientId, staffId, serviceId, date, startMinutes, durationMinutes, totalPrice, status, source, paid) VALUES (?, ?, ?, ?, '2099-04-15', 600, 30, 1000, 'new', 'dashboard', 0)",
      [tenantA, clientResult.insertId, staffResult.insertId, serviceResult.insertId],
    );

    await expect(listDetailedBookings(tenantA, "2099-04-15")).resolves.toEqual([]);
  });
});
