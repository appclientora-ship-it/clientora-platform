import { describe, expect, it } from "vitest";
import { hasBookingConflict, isBookingStartInFuture, isTenantPublicBookingEnabled, isValidBookingDate } from "./db";

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
