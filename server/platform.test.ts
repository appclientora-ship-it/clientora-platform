import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { COOKIE_NAME } from "../shared/const";

afterEach(() => vi.unstubAllEnvs());

describe("independent Clientora runtime", () => {
  it("reads database and storage configuration without Manus credentials", () => {
    vi.stubEnv("DATABASE_URL", "mysql://clientora:test@localhost/clientora");
    vi.stubEnv("S3_BUCKET", "clientora-assets");
    vi.stubEnv("S3_REGION", "eu-central-1");
    expect(ENV.databaseUrl).toBe("mysql://clientora:test@localhost/clientora");
    expect(ENV.s3Bucket).toBe("clientora-assets");
    expect(ENV.s3Region).toBe("eu-central-1");
    expect("manusApiUrl" in ENV).toBe(false);
    expect("manusApiKey" in ENV).toBe(false);
  });

  it("uses the dedicated Clientora session cookie", () => {
    expect(COOKIE_NAME).toBe("clientora_session");
  });
});
