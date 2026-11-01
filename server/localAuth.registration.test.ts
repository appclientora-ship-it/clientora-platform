import { describe, expect, it } from "vitest";
import { assertEmailRegistrationAllowed } from "./localAuth";

describe("local registration email ownership", () => {
  it("allows registration when the email is not already present", () => {
    expect(() => assertEmailRegistrationAllowed(undefined)).not.toThrow();
  });

  it("does not allow a local registration to claim an existing external-auth account", () => {
    expect(() => assertEmailRegistrationAllowed({ passwordHash: null }))
      .toThrow("هذا البريد مسجل بالفعل");
  });

  it("does not allow a local registration to replace an existing password account", () => {
    expect(() => assertEmailRegistrationAllowed({ passwordHash: "existing-hash" }))
      .toThrow("هذا البريد مسجل بالفعل");
  });
});
