import { createHash } from "node:crypto";

/** Normalize invite input consistently before hashing. */
export function hashStaffInviteCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}
