import { describe, expect, it } from "vitest";
import { getDateInTimeZone } from "../shared/date";

describe("tenant-local date formatting", () => {
  const instant = new Date("2026-11-01T00:30:00.000Z");

  it("uses the tenant timezone instead of the browser timezone", () => {
    expect(getDateInTimeZone("Asia/Muscat", instant)).toBe("2026-11-01");
    expect(getDateInTimeZone("America/New_York", instant)).toBe("2026-10-31");
  });

  it("handles the Moscow local date boundary", () => {
    expect(getDateInTimeZone("Europe/Moscow", instant)).toBe("2026-11-01");
  });
});
