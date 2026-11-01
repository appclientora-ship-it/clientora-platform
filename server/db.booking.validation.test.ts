import { describe, expect, it } from "vitest";
import { buildAvailableBookingSlots, createPublicBooking, hasStaffBreakConflict, isWithinStaffWorkingHours } from "./db";

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


describe("booking availability validation", () => {
  const base = {
    weekday: 4,
    openMinutes: 540,
    closeMinutes: 720,
    durationMinutes: 30,
    isFuture: () => true,
  };

  it("does not offer a slot that overlaps an existing booking", () => {
    const slots = buildAvailableBookingSlots({
      ...base,
      existingBookings: [{ id: 1, startMinutes: 600, durationMinutes: 60, status: "confirmed" }],
    });
    expect(slots).not.toContain(630);
    expect(slots).toContain(660);
  });

  it("does not block a slot because of a cancelled booking", () => {
    const slots = buildAvailableBookingSlots({
      ...base,
      existingBookings: [{ id: 1, startMinutes: 600, durationMinutes: 60, status: "cancelled" }],
    });
    expect(slots).toContain(600);
  });

  it("allows a booking ending exactly at closing time", () => {
    expect(isWithinStaffWorkingHours(4, 690, 30, [
      { weekday: 4, openMinutes: 540, closeMinutes: 720, active: 1 },
    ])).toBe(true);
  });

  it("rejects a booking extending beyond closing time", () => {
    expect(isWithinStaffWorkingHours(4, 690, 45, [
      { weekday: 4, openMinutes: 540, closeMinutes: 720, active: 1 },
    ])).toBe(false);
  });

  it("rejects a booking when the employee has no active schedule that day", () => {
    expect(isWithinStaffWorkingHours(4, 600, 30, [
      { weekday: 4, openMinutes: 540, closeMinutes: 720, active: 0 },
    ])).toBe(false);
  });
});
