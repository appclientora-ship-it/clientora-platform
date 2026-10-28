import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
});

export const passwordResets = mysqlTable("passwordResets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "trial", "suspended"]).default("trial").notNull(),
  city: varchar("city", { length: 120 }),
  currency: varchar("currency", { length: 12 }).default("ر.ع").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tenantMembers = mysqlTable("tenantMembers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "manager", "staff"]).default("staff").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const staff = mysqlTable("staff", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  role: varchar("role", { length: 160 }).notNull(),
  color: varchar("color", { length: 16 }).default("#0d8f83").notNull(),
  active: int("active").default(1).notNull(),
});

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 120 }).default("عام").notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  price: int("price").notNull(),
  active: int("active").default(1).notNull(),
});

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  visits: int("visits").default(0).notNull(),
  totalSpent: int("totalSpent").default(0).notNull(),
  lastVisit: varchar("lastVisit", { length: 10 }),
});

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  clientId: int("clientId").notNull(),
  staffId: int("staffId").notNull(),
  serviceId: int("serviceId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  startMinutes: int("startMinutes").notNull(),
  durationMinutes: int("durationMinutes").default(60).notNull(),
  totalPrice: int("totalPrice").default(0).notNull(),
  status: mysqlEnum("status", ["new", "confirmed", "arrived", "cancelled", "no_show"]).default("new").notNull(),
  source: mysqlEnum("source", ["dashboard", "online"]).default("dashboard").notNull(),
  paid: int("paid").default(0).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const bookingItems = mysqlTable("bookingItems", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  bookingId: int("bookingId").notNull(),
  serviceId: int("serviceId").notNull(),
  staffId: int("staffId").notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  price: int("price").notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 120 }).notNull(),
  entity: varchar("entity", { length: 80 }).notNull(),
  entityId: int("entityId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: varchar("description", { length: 240 }).notNull(),
  vendor: varchar("vendor", { length: 160 }),
  amount: int("amount").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 40 }).default("نقدي").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
