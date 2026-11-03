import "dotenv/config";
import { bootstrapFirstSuperAdmin } from "../server/platformAdmin";

async function main() {
  const rawId = process.argv[2];
  const userId = Number(rawId);
  if (!rawId || !/^\d+$/.test(rawId) || !Number.isSafeInteger(userId) || userId < 1) {
    throw new Error("Usage: PLATFORM_OWNER_EMAIL=<verified-owner-email> SUPER_ADMIN_BOOTSTRAP_TOKEN=<server-only-secret> pnpm admin:bootstrap -- <local-user-id>");
  }
  const result = await bootstrapFirstSuperAdmin(userId);
  console.log(`Super Admin bootstrap completed for local user ID ${result.userId}.`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Super Admin bootstrap failed");
  process.exit(1);
});
