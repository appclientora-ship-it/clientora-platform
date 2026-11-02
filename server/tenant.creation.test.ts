import { describe, expect, it } from "vitest";
import { assertTenantCreationAllowed } from "./db";

describe("tenant creation permissions", () => {
  it("allows a new user to create their first company", () => {
    expect(() => assertTenantCreationAllowed("user", [])).not.toThrow();
  });

  it("allows an existing company owner to create another company", () => {
    expect(() => assertTenantCreationAllowed("user", [{ role: "owner" }, { role: "staff" }])).not.toThrow();
  });

  it("blocks staff from creating a company", () => {
    expect(() => assertTenantCreationAllowed("user", [{ role: "staff" }]))
      .toThrow("إنشاء شركة جديدة متاح لصاحب الشركة فقط");
  });

  it("blocks managers from creating a company unless they also own a company", () => {
    expect(() => assertTenantCreationAllowed("user", [{ role: "manager" }]))
      .toThrow("إنشاء شركة جديدة متاح لصاحب الشركة فقط");
  });

  it("allows platform administrators", () => {
    expect(() => assertTenantCreationAllowed("admin", [{ role: "staff" }])).not.toThrow();
  });
});
