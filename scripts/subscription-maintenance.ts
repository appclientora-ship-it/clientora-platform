import { runSubscriptionMaintenance } from "../server/db";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run subscription maintenance");
}

try {
  const result = await runSubscriptionMaintenance();
  console.info("[subscriptions] maintenance completed", result);
  process.exit(0);
} catch (error) {
  console.error("[subscriptions] maintenance failed", error);
  process.exit(1);
}
