import { describe, expect, it } from "vitest";
import { bookingDateSchema } from "./validation";

describe("bookingDateSchema", () => {
  it.each(["2026-11-01", "2024-02-29"])("accepts a real calendar date: %s", value => {
    expect(bookingDateSchema.safeParse(value).success).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-01", "01-11-2026", ""])(
    "rejects an invalid calendar date: %s",
    value => {
      expect(bookingDateSchema.safeParse(value).success).toBe(false);
    },
  );
});
