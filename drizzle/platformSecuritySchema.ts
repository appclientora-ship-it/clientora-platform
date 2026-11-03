import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const platformAdminBootstrap = mysqlTable("platformAdminBootstrap", {
  id: int("id").primaryKey(),
  claimedAt: timestamp("claimedAt", { mode: "date", fsp: 3 }),
  claimedByUserId: int("claimedByUserId"),
});

export const platformAdminAuditLogs = mysqlTable("platformAdminAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  targetUserId: int("targetUserId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  previousRole: varchar("previousRole", { length: 20 }).notNull(),
  newRole: varchar("newRole", { length: 20 }).notNull(),
  reason: varchar("reason", { length: 500 }),
  actorIp: varchar("actorIp", { length: 64 }),
  actorUserAgent: varchar("actorUserAgent", { length: 500 }),
  createdAt: timestamp("createdAt", { mode: "date", fsp: 3 }).defaultNow().notNull(),
});

export const rateLimitBuckets = mysqlTable("rateLimitBuckets", {
  bucketKey: varchar("bucketKey", { length: 64 }).primaryKey(),
  count: int("count").unsigned().notNull(),
  resetAt: timestamp("resetAt", { mode: "date", fsp: 3 }).notNull(),
});
