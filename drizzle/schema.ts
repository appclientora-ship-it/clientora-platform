import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
});

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  websiteUrl: varchar("websiteUrl", { length: 500 }),
  city: varchar("city", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 320 }),
  address: varchar("address", { length: 240 }),
  description: varchar("description", { length: 500 }),
  currency: varchar("currency", { length: 12 }).default("ر.ع").notNull(),
  openMinutes: int("openMinutes").default(600).notNull(),
  closeMinutes: int("closeMinutes").default(1320).notNull(),
  status: mysqlEnum("status", ["pending", "trial", "active", "suspended"]).default("pending").notNull(),
  subscriptionStartedAt: timestamp("subscriptionStartedAt"),
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
  paymentReference: varchar("paymentReference", { length: 120 }),
  paymentReceivedAt: timestamp("paymentReceivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tenantMembers = mysqlTable("tenant_members", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "manager", "staff"]).default("staff").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ membership: uniqueIndex("tenant_member_unique").on(table.tenantId, table.userId) }));

export const staff = mysqlTable("staff", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId"),
  name: varchar("name", { length: 160 }).notNull(),
  role: varchar("role", { length: 120 }).default("متخصص").notNull(),
  color: varchar("color", { length: 20 }).default("#0d8f83").notNull(),
  active: int("active").default(1).notNull(),
  commissionRate: int("commissionRate").default(0).notNull(),
  commissionBasis: mysqlEnum("commissionBasis", ["gross", "net"]).default("gross").notNull(),
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

export const staffInvites = mysqlTable("staff_invites", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  role: mysqlEnum("role", ["staff", "manager"]).default("staff").notNull(),
  active: int("active").default(1).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  visits: int("visits").default(0).notNull(),
  totalSpent: int("totalSpent").default(0).notNull(),
  lastVisit: varchar("lastVisit", { length: 10 }),
}, table => ({ phone: uniqueIndex("client_tenant_phone").on(table.tenantId, table.phone) }));

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  clientId: int("clientId").notNull(),
  staffId: int("staffId").notNull(),
  serviceId: int("serviceId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  startMinutes: int("startMinutes").notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  totalPrice: int("totalPrice").notNull(),
  status: mysqlEnum("status", ["new", "confirmed", "arrived", "cancelled", "no_show"]).default("new").notNull(),
  source: mysqlEnum("source", ["dashboard", "online"]).default("dashboard").notNull(),
  paid: int("paid").default(0).notNull(),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const bookingItems = mysqlTable("booking_items", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  bookingId: int("bookingId").notNull(),
  serviceId: int("serviceId").notNull(),
  staffId: int("staffId").notNull(),
  durationMinutes: int("durationMinutes").notNull(),
  price: int("price").notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 120 }).default("عام").notNull(),
  sku: varchar("sku", { length: 80 }),
  salePrice: int("salePrice").notNull(),
  costPrice: int("costPrice").default(0).notNull(),
  stock: int("stock").default(0).notNull(),
  lowStockAt: int("lowStockAt").default(5).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const productSales = mysqlTable("product_sales", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  productId: int("productId").notNull(),
  bookingId: int("bookingId"),
  clientId: int("clientId"),
  staffId: int("staffId").notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(),
  totalPrice: int("totalPrice").notNull(),
  commissionRate: int("commissionRate").notNull(),
  commissionAmount: int("commissionAmount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const bookingReviews = mysqlTable("booking_reviews", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  bookingId: int("bookingId").notNull(),
  clientId: int("clientId").notNull(),
  staffId: int("staffId").notNull(),
  rating: int("rating").notNull(),
  comment: varchar("comment", { length: 1000 }),
  published: int("published").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ booking: uniqueIndex("booking_review_booking_unique").on(table.bookingId) }));

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 120 }).notNull(),
  entity: varchar("entity", { length: 80 }).notNull(),
  entityId: int("entityId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingReview = typeof bookingReviews.$inferSelect;
