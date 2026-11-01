import { describe, expect, it } from "vitest";
import { buildAvailableBookingSlots, hasBookingConflict, isBookingStartInFuture, isTenantPublicBookingEnabled, isValidBookingDate, isWithinStaffWorkingHours } from "./db";

describe("booking date validation", () => {
  it.each([
    ["2026-10-31", true],
    ["2024-02-29", true],
    ["2025-02-29", false],
    ["2026-13-01", false],
    ["2026-1-01", false],
    ["31-10-2026", false],
    ["", false],
  ])("validates %s", (value, expected) => {
    expect(isValidBookingDate(value)).toBe(expected);
  });
});

describe("booking overlap validation", () => {
  const existing = [
    { id: 1, startMinutes: 600, durationMinutes: 60, status: "confirmed" },
    { id: 2, startMinutes: 720, durationMinutes: 30, status: "cancelled" },
  ];

  it("rejects a booking that overlaps an active booking", () => {
    expect(hasBookingConflict(existing, { startMinutes: 630, durationMinutes: 30 })).toBe(true);
  });

  it("allows a booking that starts exactly when another ends", () => {
    expect(hasBookingConflict(existing, { startMinutes: 660, durationMinutes: 30 })).toBe(false);
  });

  it("ignores cancelled bookings", () => {
    expect(hasBookingConflict(existing, { startMinutes: 720, durationMinutes: 30 })).toBe(false);
  });

  it("ignores the booking being edited", () => {
    expect(hasBookingConflict(existing, { startMinutes: 615, durationMinutes: 30 }, 1)).toBe(false);
  });
});


describe("public booking availability", () => {
  it("allows active and trial tenants to receive public bookings", () => {
    expect(isTenantPublicBookingEnabled("active")).toBe(true);
    expect(isTenantPublicBookingEnabled("trial")).toBe(true);
  });

  it("rejects public bookings for suspended tenants", () => {
    expect(isTenantPublicBookingEnabled("suspended")).toBe(false);
  });
});

describe("public booking future-time validation", () => {
  const now = new Date("2026-10-31T07:00:00.000Z"); // 11:00 in Muscat

  it("rejects dates before today in the tenant timezone", () => {
    expect(isBookingStartInFuture("2026-10-30", 720, "Asia/Muscat", now)).toBe(false);
  });

  it("rejects a time that has already started today in the tenant timezone", () => {
    expect(isBookingStartInFuture("2026-10-31", 660, "Asia/Muscat", now)).toBe(false);
  });

  it("allows a later time today in the tenant timezone", () => {
    expect(isBookingStartInFuture("2026-10-31", 690, "Asia/Muscat", now)).toBe(true);
  });

  it("allows a future local date across tenant timezones", () => {
    expect(isBookingStartInFuture("2026-11-01", 600, "America/New_York", now)).toBe(true);
  });

  it("fails closed for an invalid timezone", () => {
    expect(isBookingStartInFuture("2026-11-01", 600, "Invalid/Zone", now)).toBe(false);
  });
});


describe("staff working hours validation", () => {
  const hours = [{ weekday: 1, openMinutes: 540, closeMinutes: 1020, active: 1 }];

  it("accepts a booking fully inside the employee shift", () => {
    expect(isWithinStaffWorkingHours(1, 600, 60, hours)).toBe(true);
  });

  it("rejects a booking that starts before opening or ends after closing", () => {
    expect(isWithinStaffWorkingHours(1, 510, 60, hours)).toBe(false);
    expect(isWithinStaffWorkingHours(1, 990, 60, hours)).toBe(false);
  });

  it("rejects inactive days and missing schedules", () => {
    expect(isWithinStaffWorkingHours(2, 600, 60, hours)).toBe(false);
    expect(isWithinStaffWorkingHours(1, 600, 60, [{ ...hours[0], active: 0 }])).toBe(false);
  });
});

describe("available public booking slots", () => {
  it("returns only 30-minute slots within hours that do not overlap existing bookings", () => {
    const slots = buildAvailableBookingSlots({
      weekday: 1,
      openMinutes: 540,
      closeMinutes: 720,
      durationMinutes: 60,
      existingBookings: [{ id: 1, startMinutes: 600, durationMinutes: 60, status: "confirmed" }],
      isFuture: () => true,
    });
    expect(slots).toEqual([540, 660]);
  });

  it("excludes past slots and does not offer slots too close to closing", () => {
    const slots = buildAvailableBookingSlots({
      weekday: 1,
      openMinutes: 540,
      closeMinutes: 630,
      durationMinutes: 60,
      existingBookings: [],
      isFuture: start => start >= 570,
    });
    expect(slots).toEqual([570]);
  });

  it("returns no slots for an invalid or closed schedule", () => {
    expect(buildAvailableBookingSlots({
      weekday: 1,
      openMinutes: 600,
      closeMinutes: 600,
      durationMinutes: 30,
      existingBookings: [],
      isFuture: () => true,
    })).toEqual([]);
  });
});
