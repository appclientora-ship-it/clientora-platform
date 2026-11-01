import { describe, expect, it } from "vitest";
import { buildAvailableBookingSlots, hasBookingConflict, isBookingStartInFuture, isLocalBookingIntervalValid, isUniqueLocalBookingStart, isValidTenantTimeZone, isTenantPublicBookingEnabled, isValidBookingDate, isWithinStaffWorkingHours } from "./db";

describe("booking date validation", () => {
  it.each([
    ["2026-10-31", true],
    ["2024-02-29", true],
    ["2025-02-29", false],
    ["2026-13-01", false],
    ["2026-02-30", false],
    ["2026-04-31", false],
    ["2026-00-10", false],
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


describe("tenant timezone boundary validation", () => {
  it("uses the Muscat local date after UTC midnight has not yet passed", () => {
    const now = new Date("2026-10-31T20:30:00.000Z"); // 00:30 on Nov 1 in Muscat

    expect(isBookingStartInFuture("2026-10-31", 1439, "Asia/Muscat", now)).toBe(false);
    expect(isBookingStartInFuture("2026-11-01", 29, "Asia/Muscat", now)).toBe(false);
    expect(isBookingStartInFuture("2026-11-01", 31, "Asia/Muscat", now)).toBe(true);
  });

  it("uses the Moscow local date at its UTC+3 midnight boundary", () => {
    const now = new Date("2026-10-31T21:30:00.000Z"); // 00:30 on Nov 1 in Moscow

    expect(isBookingStartInFuture("2026-10-31", 1439, "Europe/Moscow", now)).toBe(false);
    expect(isBookingStartInFuture("2026-11-01", 29, "Europe/Moscow", now)).toBe(false);
    expect(isBookingStartInFuture("2026-11-01", 31, "Europe/Moscow", now)).toBe(true);
  });

  it("compares the current wall-clock time after a spring DST jump", () => {
    const now = new Date("2026-03-29T01:30:00.000Z"); // 03:30 after Berlin jumps from 02:00 to 03:00

    expect(isBookingStartInFuture("2026-03-29", 180, "Europe/Berlin", now)).toBe(false);
    expect(isBookingStartInFuture("2026-03-29", 240, "Europe/Berlin", now)).toBe(true);
  });
});


describe("tenant IANA timezone validation", () => {
  it.each(["Asia/Muscat", "Europe/Moscow", "Europe/Berlin"])("accepts supported timezone %s", timeZone => {
    expect(isValidTenantTimeZone(timeZone)).toBe(true);
  });

  it.each(["", "Invalid/Zone", "Asia/NotARealCity", "x".repeat(65)])("rejects invalid timezone %s", timeZone => {
    expect(isValidTenantTimeZone(timeZone)).toBe(false);
  });
});

describe("DST-safe local booking starts", () => {
  it("rejects a local time skipped by the spring clock change", () => {
    expect(isUniqueLocalBookingStart("2026-03-29", 150, "Europe/Berlin")).toBe(false);
  });

  it("rejects a local time repeated by the autumn clock change", () => {
    expect(isUniqueLocalBookingStart("2026-10-25", 150, "Europe/Berlin")).toBe(false);
  });

  it("accepts unique local times around both DST transitions", () => {
    expect(isUniqueLocalBookingStart("2026-03-29", 210, "Europe/Berlin")).toBe(true);
    expect(isUniqueLocalBookingStart("2026-10-25", 210, "Europe/Berlin")).toBe(true);
  });

  it("accepts Muscat local times because Muscat does not observe DST", () => {
    expect(isUniqueLocalBookingStart("2026-03-29", 150, "Asia/Muscat")).toBe(true);
  });

  it("fails closed for invalid dates, minutes, and timezones", () => {
    expect(isUniqueLocalBookingStart("2026-02-30", 150, "Europe/Berlin")).toBe(false);
    expect(isUniqueLocalBookingStart("2026-03-29", 1440, "Europe/Berlin")).toBe(false);
    expect(isUniqueLocalBookingStart("2026-03-29", 150, "Invalid/Zone")).toBe(false);
  });
});

describe("DST-safe booking intervals", () => {
  it("rejects a spring-forward interval whose local end time does not exist", () => {
    expect(isLocalBookingIntervalValid("2026-03-29", 90, 60, "Europe/Berlin")).toBe(false);
  });

  it("rejects a spring-forward interval whose elapsed time is shorter than its service duration", () => {
    expect(isLocalBookingIntervalValid("2026-03-29", 90, 120, "Europe/Berlin")).toBe(false);
  });

  it("rejects an autumn interval whose elapsed time is longer than its service duration", () => {
    expect(isLocalBookingIntervalValid("2026-10-25", 90, 120, "Europe/Berlin")).toBe(false);
  });

  it("accepts ordinary intervals after the spring transition and in Muscat", () => {
    expect(isLocalBookingIntervalValid("2026-03-29", 210, 60, "Europe/Berlin")).toBe(true);
    expect(isLocalBookingIntervalValid("2026-03-29", 150, 60, "Asia/Muscat")).toBe(true);
  });

  it("accepts a normal interval ending at local midnight", () => {
    expect(isLocalBookingIntervalValid("2026-03-28", 1380, 60, "Europe/Berlin")).toBe(true);
  });

  it("rejects invalid duration, end-of-day overflow, and invalid timezone", () => {
    expect(isLocalBookingIntervalValid("2026-03-29", 600, 0, "Europe/Berlin")).toBe(false);
    expect(isLocalBookingIntervalValid("2026-03-29", 1380, 90, "Europe/Berlin")).toBe(false);
    expect(isLocalBookingIntervalValid("2026-03-29", 600, 60, "Invalid/Zone")).toBe(false);
  });
});
