import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"), email: varchar("email", { length: 320 }), emailVerifiedAt: timestamp("emailVerifiedAt"), emailVerificationRequired: int("emailVerificationRequired").default(0).notNull(), loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(), language: varchar("language", { length: 10 }).default("ar"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(), passwordHash: varchar("passwordHash", { length: 255 }),
});
export const emailVerifications = mysqlTable("emailVerifications", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(), expiresAt: timestamp("expiresAt").notNull(), usedAt: timestamp("usedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const passwordResets = mysqlTable("passwordResets", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(), expiresAt: timestamp("expiresAt").notNull(), usedAt: timestamp("usedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(), name: varchar("name", { length: 160 }).notNull(), slug: varchar("slug", { length: 120 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "trial", "suspended"]).default("trial").notNull(), city: varchar("city", { length: 120 }), countryCode: varchar("countryCode", { length: 2 }).default("OM"), currency: varchar("currency", { length: 12 }).default("ر.ع").notNull(), timezone: varchar("timezone", { length: 64 }).default("Asia/Muscat"), defaultLanguage: varchar("defaultLanguage", { length: 10 }).default("ar"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const subscriptionPlans = mysqlTable("subscriptionPlans", {
  id: int("id").autoincrement().primaryKey(),
  planKey: varchar("planKey", { length: 16 }).notNull().unique(),
  staffLimit: int("staffLimit").notNull(),
  monthlyPriceCents: int("monthlyPriceCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tenantSubscriptions = mysqlTable("tenantSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  planId: int("planId"),
  status: mysqlEnum("status", ["pending", "active", "past_due", "suspended", "cancelled"]).default("pending").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  gracePeriodEndsAt: timestamp("gracePeriodEndsAt"),
  graceDays: int("graceDays").default(21).notNull(),
  autoRenew: int("autoRenew").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantUnique: uniqueIndex("tenantSubscriptions_tenant_unique").on(table.tenantId),
}));

export const subscriptionEvents = mysqlTable("subscriptionEvents", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 64 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tenantMembers = mysqlTable("tenantMembers", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), userId: int("userId").notNull(), role: mysqlEnum("role", ["owner", "manager", "staff"]).default("staff").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const staff = mysqlTable("staff", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), userId: int("userId"), name: varchar("name", { length: 160 }).notNull(), role: varchar("role", { length: 160 }).notNull(), color: varchar("color", { length: 16 }).default("#0d8f83").notNull(), photoUrl: varchar("photoUrl", { length: 500 }), bio: varchar("bio", { length: 500 }), active: int("active").default(1).notNull(),
});
export const staffWorkingHours = mysqlTable("staffWorkingHours", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), staffId: int("staffId").notNull(), weekday: int("weekday").notNull(), openMinutes: int("openMinutes").notNull(), closeMinutes: int("closeMinutes").notNull(), active: int("active").default(1).notNull(),
});
export const staffTimeOff = mysqlTable("staffTimeOff", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), staffId: int("staffId").notNull(), date: varchar("date", { length: 10 }).notNull(), reason: varchar("reason", { length: 240 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export { platformAdminBootstrap, platformAdminAuditLogs, rateLimitBuckets } from "./platformSecuritySchema";
export const staffInvites = mysqlTable("staffInvites", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), staffId: int("staffId"), email: varchar("email", { length: 320 }), code: varchar("code", { length: 64 }).notNull().unique(), role: mysqlEnum("role", ["staff", "manager"]).default("staff").notNull(), expiresAt: timestamp("expiresAt").notNull(), acceptedAt: timestamp("acceptedAt"), createdByUserId: int("createdByUserId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), name: varchar("name", { length: 160 }).notNull(), category: varchar("category", { length: 120 }).default("عام").notNull(), durationMinutes: int("durationMinutes").notNull(), price: int("price").notNull(), active: int("active").default(1).notNull(),
});
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), name: varchar("name", { length: 160 }).notNull(), phone: varchar("phone", { length: 40 }), visits: int("visits").default(0).notNull(), totalSpent: int("totalSpent").default(0).notNull(), lastVisit: varchar("lastVisit", { length: 10 }),
});
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), clientId: int("clientId").notNull(), staffId: int("staffId").notNull(), serviceId: int("serviceId").notNull(), date: varchar("date", { length: 10 }).notNull(), startMinutes: int("startMinutes").notNull(), durationMinutes: int("durationMinutes").default(60).notNull(), totalPrice: int("totalPrice").default(0).notNull(), status: mysqlEnum("status", ["new", "confirmed", "arrived", "completed", "cancelled", "no_show"]).default("new").notNull(), source: mysqlEnum("source", ["dashboard", "online"]).default("dashboard").notNull(), paid: int("paid").default(0).notNull(), note: text("note"), completedAt: timestamp("completedAt"), idempotencyKey: varchar("idempotencyKey", { length: 64 }), requestHash: varchar("requestHash", { length: 64 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ publicRequestUnique: uniqueIndex("bookings_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey) }));
export const bookingItems = mysqlTable("bookingItems", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), bookingId: int("bookingId").notNull(), serviceId: int("serviceId").notNull(), staffId: int("staffId").notNull(), durationMinutes: int("durationMinutes").notNull(), price: int("price").notNull(),
});
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), recipientUserId: int("recipientUserId"), recipientStaffId: int("recipientStaffId"), type: varchar("type", { length: 60 }).notNull(), title: varchar("title", { length: 180 }).notNull(), body: varchar("body", { length: 500 }).notNull(), entity: varchar("entity", { length: 80 }), entityId: int("entityId"), readAt: timestamp("readAt"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const bookingReviews = mysqlTable("bookingReviews", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), bookingId: int("bookingId").notNull().unique(), clientId: int("clientId").notNull(), staffId: int("staffId").notNull(), rating: int("rating").notNull(), comment: varchar("comment", { length: 1000 }), published: int("published").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId"), actorUserId: int("actorUserId"), action: varchar("action", { length: 120 }).notNull(), entity: varchar("entity", { length: 80 }).notNull(), entityId: int("entityId"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), category: varchar("category", { length: 100 }).notNull(), description: varchar("description", { length: 240 }).notNull(), vendor: varchar("vendor", { length: 160 }), amount: int("amount").notNull(), date: varchar("date", { length: 10 }).notNull(), paymentMethod: varchar("paymentMethod", { length: 40 }).default("نقدي").notNull(), createdBy: int("createdBy"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect; export type InsertUser = typeof users.$inferInsert; export type Tenant = typeof tenants.$inferSelect; export type Staff = typeof staff.$inferSelect; export type Service = typeof services.$inferSelect; export type Client = typeof clients.$inferSelect; export type Booking = typeof bookings.$inferSelect;

export const clientNotes = mysqlTable("clientNotes", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), clientId: int("clientId").notNull(), authorUserId: int("authorUserId").notNull(), note: text("note").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});


export const telegramLinks = mysqlTable("telegramLinks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  telegramUserUnique: uniqueIndex("telegramLinks_telegram_user_unique").on(table.telegramUserId),
}));

export const telegramLinkTokens = mysqlTable("telegramLinkTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const staffBreaks = mysqlTable("staffBreaks", {
  id: int("id").autoincrement().primaryKey(), tenantId: int("tenantId").notNull(), staffId: int("staffId").notNull(), weekday: int("weekday").notNull(), startMinutes: int("startMinutes").notNull(), endMinutes: int("endMinutes").notNull(), active: int("active").default(1).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
