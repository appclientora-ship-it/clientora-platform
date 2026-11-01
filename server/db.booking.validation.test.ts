import { describe, expect, it } from "vitest";
import { createPublicBooking, hasStaffBreakConflict } from "./db";

const validInput = {
  slug: "test-salon",
  clientName: "Test Client",
  phone: "+96890000000",
  serviceId: 1,
  staffId: 1,
  date: "2099-01-15",
  startMinutes: 600,
  idempotencyKey: "test-request-key",
};

describe("public booking idempotency key validation", () => {
  it("rejects an empty idempotency key before accessing the database", async () => {
    await expect(createPublicBooking({ ...validInput, idempotencyKey: "" }))
      .rejects.toThrow("مفتاح الحجز غير صالح");
  });

  it("rejects a whitespace-only idempotency key before accessing the database", async () => {
    await expect(createPublicBooking({ ...validInput, idempotencyKey: "   " }))
      .rejects.toThrow("مفتاح الحجز غير صالح");
  });

  it("rejects an idempotency key longer than the database column", async () => {
    await expect(createPublicBooking({ ...validInput, idempotencyKey: "a".repeat(65) }))
      .rejects.toThrow("مفتاح الحجز غير صالح");
  });

  it("trims surrounding whitespace from a valid idempotency key", async () => {
    await expect(createPublicBooking({ ...validInput, idempotencyKey: "  valid-key  " }))
      .rejects.toThrow("Company not found");
  });
});


describe("staff break conflict validation", () => {
  const breakPeriod = [{ startMinutes: 720, endMinutes: 780 }];
  it("rejects a booking that overlaps the start of a break", () => {
    expect(hasStaffBreakConflict(breakPeriod, { startMinutes: 705, durationMinutes: 30 })).toBe(true);
  });
  it("rejects a booking that starts during a break", () => {
    expect(hasStaffBreakConflict(breakPeriod, { startMinutes: 735, durationMinutes: 30 })).toBe(true);
  });
  it("allows a booking that ends exactly when a break begins", () => {
    expect(hasStaffBreakConflict(breakPeriod, { startMinutes: 690, durationMinutes: 30 })).toBe(false);
  });
  it("allows a booking that starts exactly when a break ends", () => {
    expect(hasStaffBreakConflict(breakPeriod, { startMinutes: 780, durationMinutes: 30 })).toBe(false);
  });
});
