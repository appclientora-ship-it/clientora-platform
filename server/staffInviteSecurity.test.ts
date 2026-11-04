import { describe, expect, it } from "vitest";
import { hashStaffInviteCode } from "./staffInviteSecurity";

describe("staff invite token hashing", () => {
  const rawCode = "a".repeat(36);

  it("returns a lowercase SHA-256 hex digest", () => {
    expect(hashStaffInviteCode(rawCode)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not return or preserve the raw invite token", () => {
    expect(hashStaffInviteCode(rawCode)).not.toBe(rawCode);
  });

  it("normalizes surrounding whitespace consistently", () => {
    expect(hashStaffInviteCode(`  ${rawCode}  `)).toBe(hashStaffInviteCode(rawCode));
  });
});
