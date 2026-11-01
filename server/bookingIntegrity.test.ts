import { describe, expect, it } from "vitest";
import { hasBookingConflict } from "./db";

describe("hasBookingConflict", () => {
  const existing = [
    { id: 1, startMinutes: 9 * 60, durationMinutes: 60, status: "confirmed" },
    { id: 2, startMinutes: 11 * 60, durationMinutes: 30, status: "cancelled" },
  ];

  it("detects a candidate that overlaps an existing active booking", () => {
    expect(hasBookingConflict(existing, { startMinutes: 9 * 60 + 30, durationMinutes: 30 })).toBe(true);
  });

  it("allows appointments that start exactly when another ends", () => {
    expect(hasBookingConflict(existing, { startMinutes: 10 * 60, durationMinutes: 30 })).toBe(false);
  });

  it("ignores cancelled bookings", () => {
    expect(hasBookingConflict(existing, { startMinutes: 11 * 60, durationMinutes: 30 })).toBe(false);
  });

  it("ignores the booking currently being edited", () => {
    expect(hasBookingConflict(existing, { startMinutes: 9 * 60, durationMinutes: 60 }, 1)).toBe(false);
  });

  it("detects a candidate that fully contains an existing booking", () => {
    expect(hasBookingConflict(existing, { startMinutes: 8 * 60, durationMinutes: 3 * 60 })).toBe(true);
  });

  it("detects a candidate that is fully contained by an existing booking", () => {
    expect(hasBookingConflict(existing, { startMinutes: 9 * 60 + 10, durationMinutes: 10 })).toBe(true);
  });
});
