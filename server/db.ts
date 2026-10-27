import { and, desc, eq, gt, gte, lte, lt, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, auditLogs, bookingItems, bookingReviews, bookings, clients, notifications, productSales, products, services, staff, staffInvites, tenantMembers, tenants, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, lastSignedIn: user.lastSignedIn ?? new Date() };
  if (user.role || user.openId === ENV.ownerOpenId) { values.role = user.role ?? "admin"; updateSet.role = values.role; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function canAccessTenant(userId: number, role: string, tenantId: number) {
  if (role === "admin") return true;
  const db = await getDb(); if (!db) return false;
  const result = await db.select({ id: tenantMembers.id }).from(tenantMembers).where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId))).limit(1);
  return result.length > 0;
}

export async function listTenants() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(tenants).orderBy(desc(tenants.createdAt));
}

export async function listTenantsForUser(userId: number, role: string) {
  const db = await getDb(); if (!db) return [];
  if (role === "admin") return listTenants();
  return db.select({ id: tenants.id, name: tenants.name, slug: tenants.slug, websiteUrl: tenants.websiteUrl, city: tenants.city, currency: tenants.currency, status: tenants.status, createdAt: tenants.createdAt })
    .from(tenants).innerJoin(tenantMembers, eq(tenantMembers.tenantId, tenants.id)).where(eq(tenantMembers.userId, userId)).orderBy(desc(tenants.createdAt));
}

export async function createStaffInvite(userId: number, role: string, tenantId: number, inviteRole: "staff" | "manager") {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const member = (await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId))).limit(1))[0];
  if (role !== "admin" && member?.role !== "owner" && member?.role !== "manager") throw new Error("فقط مالك الشركة أو المدير يستطيع دعوة الموظفين");
  const code = `CL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await db.insert(staffInvites).values({ tenantId, code, role: inviteRole, createdByUserId: userId, active: 1 });
  return { code, tenantId };
}

export async function joinTenantByInvite(userId: number, code: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const invite = (await db.select().from(staffInvites).where(and(eq(staffInvites.code, code.toUpperCase()), eq(staffInvites.active, 1))).limit(1))[0];
  if (!invite) throw new Error("رمز الدعوة غير صحيح أو منتهي");
  const existing = (await db.select().from(tenantMembers).where(and(eq(tenantMembers.tenantId, invite.tenantId), eq(tenantMembers.userId, userId))).limit(1))[0];
  if (!existing) await db.insert(tenantMembers).values({ tenantId: invite.tenantId, userId, role: invite.role });
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  const linkedStaff = (await db.select().from(staff).where(and(eq(staff.tenantId, invite.tenantId), eq(staff.userId, userId))).limit(1))[0];
  if (!linkedStaff) await db.insert(staff).values({ tenantId: invite.tenantId, userId, name: user?.name || user?.email || "موظف جديد", role: invite.role === "manager" ? "مدير" : "موظف", active: 1 });
  await db.insert(auditLogs).values({ tenantId: invite.tenantId, actorUserId: userId, action: "staff.joined", entity: "tenant_member", entityId: invite.tenantId });
  return (await db.select().from(tenants).where(eq(tenants.id, invite.tenantId)).limit(1))[0];
}

export async function listStaffInvites(userId: number, role: string, tenantId: number) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  return db.select().from(staffInvites).where(and(eq(staffInvites.tenantId, tenantId), eq(staffInvites.active, 1))).orderBy(desc(staffInvites.createdAt));
}

export async function getPublicCatalog(slug: string) {
  const db = await getDb(); if (!db) return null;
  const tenantResult = await db.select().from(tenants).where(and(eq(tenants.slug, slug), or(eq(tenants.status, "active"), eq(tenants.status, "trial")))).limit(1);
  const tenant = tenantResult[0]; if (!tenant) return null;
  if (tenant.subscriptionEndsAt && tenant.subscriptionEndsAt <= new Date()) return null;
  const [serviceList, staffList, reviewList] = await Promise.all([
    db.select().from(services).where(and(eq(services.tenantId, tenant.id), eq(services.active, 1))),
    db.select().from(staff).where(and(eq(staff.tenantId, tenant.id), eq(staff.active, 1))),
    db.select().from(bookingReviews).where(and(eq(bookingReviews.tenantId, tenant.id), eq(bookingReviews.published, 1))).orderBy(desc(bookingReviews.createdAt)).limit(80),
  ]);
  const reviews = reviewList.map(review => ({ id: review.id, staffId: review.staffId, rating: review.rating, comment: review.comment, createdAt: review.createdAt }));
  const staffWithReviews = staffList.map(person => {
    const personReviews = reviews.filter(review => review.staffId === person.id);
    const rating = personReviews.length ? Math.round((personReviews.reduce((sum, review) => sum + review.rating, 0) / personReviews.length) * 10) / 10 : 0;
    return { ...person, rating, reviewCount: personReviews.length };
  });
  return { tenant, services: serviceList, staff: staffWithReviews, reviews };
}

export async function listBookingsForTenant(tenantId: number, date: string) {
  const db = await getDb(); if (!db) return [];
  return db.select({ booking: bookings, client: clients, service: services, staff: staff, review: bookingReviews })
    .from(bookings).innerJoin(clients, eq(clients.id, bookings.clientId)).innerJoin(services, eq(services.id, bookings.serviceId)).innerJoin(staff, eq(staff.id, bookings.staffId))
    .leftJoin(bookingReviews, eq(bookingReviews.bookingId, bookings.id))
    .where(and(eq(bookings.tenantId, tenantId), eq(bookings.date, date))).orderBy(bookings.startMinutes);
}

export async function createTenant(userId: number, input: { name: string; slug: string; websiteUrl?: string; city?: string; currency?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const result = await db.insert(tenants).values({ name: input.name, slug: input.slug, websiteUrl: input.websiteUrl, city: input.city, currency: input.currency ?? "ر.ع", openMinutes: 600, closeMinutes: 1320, status: "pending" });
  const tenantId = Number(result[0].insertId);
  await db.insert(tenantMembers).values({ tenantId, userId, role: "owner" });
  await db.insert(auditLogs).values({ tenantId, actorUserId: userId, action: "tenant.created.pending_approval", entity: "tenant", entityId: tenantId });
  return (await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1))[0];
}

export async function addService(userId: number, role: string, input: { tenantId: number; name: string; category?: string; durationMinutes: number; price: number }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const result = await db.insert(services).values({ tenantId: input.tenantId, name: input.name, category: input.category ?? "عام", durationMinutes: input.durationMinutes, price: input.price, active: 1 });
  return (await db.select().from(services).where(eq(services.id, Number(result[0].insertId))).limit(1))[0];
}

export async function addStaff(userId: number, role: string, input: { tenantId: number; name: string; staffRole?: string }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const result = await db.insert(staff).values({ tenantId: input.tenantId, name: input.name, role: input.staffRole ?? "متخصص", active: 1 });
  return (await db.select().from(staff).where(eq(staff.id, Number(result[0].insertId))).limit(1))[0];
}

export async function updateStaff(userId: number, role: string, input: { tenantId: number; staffId: number; name: string; staffRole: string; active: boolean; commissionRate: number; commissionBasis: "gross" | "net" }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  if (input.commissionRate < 0 || input.commissionRate > 100) throw new Error("نسبة العمولة يجب أن تكون بين 0 و100");
  await db.update(staff).set({ name: input.name, role: input.staffRole, active: input.active ? 1 : 0, commissionRate: input.commissionRate, commissionBasis: input.commissionBasis }).where(and(eq(staff.id, input.staffId), eq(staff.tenantId, input.tenantId)));
  await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: userId, action: "staff.updated", entity: "staff", entityId: input.staffId });
  return { ok: true };
}

export async function getTenantOperations(userId: number, role: string, tenantId: number) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const [tenant, serviceList, staffList] = await Promise.all([
    db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1),
    db.select().from(services).where(eq(services.tenantId, tenantId)),
    db.select().from(staff).where(eq(staff.tenantId, tenantId)),
  ]);
  return { tenant: tenant[0], services: serviceList, staff: staffList };
}

export async function listClientsForTenant(userId: number, role: string, tenantId: number) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  return db.select().from(clients).where(eq(clients.tenantId, tenantId)).orderBy(desc(clients.lastVisit));
}

export async function getTenantReports(userId: number, role: string, tenantId: number, from: string, to: string) {
  const db = await getDb();
  if (!db || !(await canAccessTenant(userId, role, tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const rows = await db.select({ booking: bookings, client: clients, service: services, staff })
    .from(bookings).innerJoin(clients, eq(clients.id, bookings.clientId)).innerJoin(services, eq(services.id, bookings.serviceId)).innerJoin(staff, eq(staff.id, bookings.staffId))
    .where(and(eq(bookings.tenantId, tenantId), gte(bookings.date, from), lte(bookings.date, to)))
    .orderBy(desc(bookings.date), desc(bookings.startMinutes));
  const byStaff = new Map<number, { id: number; name: string; bookings: number; revenue: number; paid: number }>();
  const byService = new Map<number, { id: number; name: string; bookings: number; revenue: number }>();
  const byDay = new Map<string, { date: string; bookings: number; revenue: number; paid: number }>();
  const clientIds = new Set<number>();
  let revenue = 0, collected = 0, cancelled = 0, noShow = 0, unpaid = 0;
  for (const row of rows) {
    const b = row.booking; const isCancelled = b.status === "cancelled"; const isNoShow = b.status === "no_show";
    if (isCancelled) cancelled++; if (isNoShow) noShow++; if (!isCancelled && !isNoShow) revenue += b.totalPrice;
    if (b.paid && !isCancelled) collected += b.totalPrice;
    if (!b.paid && !isCancelled && !isNoShow) unpaid += b.totalPrice;
    clientIds.add(row.client.id);
    const staffRow = byStaff.get(row.staff.id) ?? { id: row.staff.id, name: row.staff.name, bookings: 0, revenue: 0, paid: 0 };
    staffRow.bookings++; if (!isCancelled && !isNoShow) staffRow.revenue += b.totalPrice; if (b.paid && !isCancelled) staffRow.paid += b.totalPrice; byStaff.set(row.staff.id, staffRow);
    const serviceRow = byService.get(row.service.id) ?? { id: row.service.id, name: row.service.name, bookings: 0, revenue: 0 };
    serviceRow.bookings++; if (!isCancelled && !isNoShow) serviceRow.revenue += b.totalPrice; byService.set(row.service.id, serviceRow);
    const day = byDay.get(b.date) ?? { date: b.date, bookings: 0, revenue: 0, paid: 0 };
    day.bookings++; if (!isCancelled && !isNoShow) day.revenue += b.totalPrice; if (b.paid && !isCancelled) day.paid += b.totalPrice; byDay.set(b.date, day);
  }
  return { period: { from, to }, summary: { bookings: rows.length, activeBookings: rows.length - cancelled - noShow, revenue, collected, unpaid, cancelled, noShow, clients: clientIds.size, averageBooking: rows.length - cancelled - noShow ? Math.round(revenue / (rows.length - cancelled - noShow)) : 0 }, byStaff: [...byStaff.values()].sort((a, b) => b.revenue - a.revenue), byService: [...byService.values()].sort((a, b) => b.bookings - a.bookings), byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export async function updateTenantHours(userId: number, role: string, input: { tenantId: number; openMinutes: number; closeMinutes: number }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  if (input.closeMinutes <= input.openMinutes) throw new Error("وقت الإغلاق يجب أن يكون بعد وقت الفتح");
  await db.update(tenants).set({ openMinutes: input.openMinutes, closeMinutes: input.closeMinutes }).where(eq(tenants.id, input.tenantId));
  await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: userId, action: "tenant.hours.updated", entity: "tenant", entityId: input.tenantId });
  return { ok: true };
}

export async function updateTenantProfile(userId: number, role: string, input: { tenantId: number; name: string; slug: string; city?: string; phone?: string; email?: string; address?: string; description?: string; currency: string }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  await db.update(tenants).set({ name: input.name, slug: input.slug, city: input.city, phone: input.phone, email: input.email, address: input.address, description: input.description, currency: input.currency }).where(eq(tenants.id, input.tenantId));
  await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: userId, action: "tenant.profile.updated", entity: "tenant", entityId: input.tenantId });
  return (await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1))[0];
}

export async function updateBooking(userId: number, role: string, input: { tenantId: number; bookingId: number; status?: "new" | "confirmed" | "arrived" | "cancelled" | "no_show"; paid?: boolean; note?: string; staffId?: number; date?: string; startMinutes?: number; durationMinutes?: number }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const current = (await db.select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.tenantId, input.tenantId))).limit(1))[0];
  if (!current) throw new Error("الحجز غير موجود");
  const nextStaff = input.staffId ?? current.staffId;
  const nextDate = input.date ?? current.date;
  const nextStart = input.startMinutes ?? current.startMinutes;
  const nextDuration = input.durationMinutes ?? current.durationMinutes;
  const nextEnd = nextStart + nextDuration;
  const tenant = (await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1))[0];
  if (tenant && (nextStart < tenant.openMinutes || nextEnd > tenant.closeMinutes)) throw new Error("الموعد خارج ساعات العمل");
  const conflicts = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.tenantId, input.tenantId), eq(bookings.staffId, nextStaff), eq(bookings.date, nextDate), ne(bookings.status, "cancelled"), ne(bookings.id, input.bookingId), lt(bookings.startMinutes, nextEnd), gt(sql`${bookings.startMinutes} + ${bookings.durationMinutes}`, nextStart))).limit(1);
  if (conflicts.length) throw new Error("هذا الوقت محجوز بالفعل، اختر وقتاً آخر");
  await db.update(bookings).set({ status: input.status ?? current.status, paid: input.paid === undefined ? current.paid : input.paid ? 1 : 0, note: input.note === undefined ? current.note : input.note, staffId: nextStaff, date: nextDate, startMinutes: nextStart, durationMinutes: nextDuration }).where(eq(bookings.id, input.bookingId));
  await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: userId, action: "booking.updated", entity: "booking", entityId: input.bookingId });
  return { ok: true };
}

export async function createPublicBooking(input: { slug: string; clientName: string; phone: string; serviceIds: number[]; staffId: number; date: string; startMinutes: number; note?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const catalog = await getPublicCatalog(input.slug); if (!catalog) throw new Error("الشركة غير متاحة للحجز");
  const selected = catalog.services.filter(service => input.serviceIds.includes(service.id));
  if (!selected.length) throw new Error("اختر خدمة واحدة على الأقل");
  const selectedStaff = catalog.staff.find(item => item.id === input.staffId); if (!selectedStaff) throw new Error("الموظف غير متاح");
  const duration = selected.reduce((sum, service) => sum + service.durationMinutes, 0);
  const totalPrice = selected.reduce((sum, service) => sum + service.price, 0);
  const endMinutes = input.startMinutes + duration;
  if (input.startMinutes < catalog.tenant.openMinutes || endMinutes > catalog.tenant.closeMinutes) throw new Error("هذا الوقت خارج ساعات العمل، اختر وقتاً آخر");
  const conflicts = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.tenantId, catalog.tenant.id), eq(bookings.staffId, input.staffId), eq(bookings.date, input.date), ne(bookings.status, "cancelled"), lt(bookings.startMinutes, endMinutes), gt(sql`${bookings.startMinutes} + ${bookings.durationMinutes}`, input.startMinutes))).limit(1);
  if (conflicts.length) throw new Error("هذا الوقت محجوز بالفعل، اختر وقتاً آخر");
  let client = (await db.select().from(clients).where(and(eq(clients.tenantId, catalog.tenant.id), eq(clients.phone, input.phone))).limit(1))[0];
  if (!client) {
    const result = await db.insert(clients).values({ tenantId: catalog.tenant.id, name: input.clientName, phone: input.phone });
    client = (await db.select().from(clients).where(eq(clients.id, Number(result[0].insertId))).limit(1))[0];
  } else if (client.name !== input.clientName) {
    await db.update(clients).set({ name: input.clientName }).where(eq(clients.id, client.id));
  }
  const bookingResult = await db.insert(bookings).values({ tenantId: catalog.tenant.id, clientId: client.id, staffId: input.staffId, serviceId: selected[0].id, date: input.date, startMinutes: input.startMinutes, durationMinutes: duration, totalPrice, status: "new", source: "online", paid: 0, note: input.note });
  const bookingId = Number(bookingResult[0].insertId);
  await db.insert(bookingItems).values(selected.map(service => ({ tenantId: catalog.tenant.id, bookingId, serviceId: service.id, staffId: input.staffId, durationMinutes: service.durationMinutes, price: service.price })));
  await db.insert(auditLogs).values({ tenantId: catalog.tenant.id, action: "booking.created", entity: "booking", entityId: bookingId });
  await db.insert(notifications).values({ tenantId: catalog.tenant.id, title: "حجز جديد", body: `تم استلام حجز جديد من ${input.clientName}` });
  return { bookingId, tenant: catalog.tenant, date: input.date, startMinutes: input.startMinutes, duration, totalPrice };
}

export async function submitPublicReview(input: { slug: string; bookingId: number; phone: string; rating: number; comment?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("التقييم يجب أن يكون من نجمة إلى خمس نجوم");
  const catalog = await getPublicCatalog(input.slug); if (!catalog) throw new Error("الشركة غير متاحة");
  const row = (await db.select({ booking: bookings, client: clients }).from(bookings).innerJoin(clients, eq(clients.id, bookings.clientId)).where(and(eq(bookings.id, input.bookingId), eq(bookings.tenantId, catalog.tenant.id), eq(clients.phone, input.phone))).limit(1))[0];
  if (!row) throw new Error("بيانات الحجز أو رقم الهاتف غير صحيحة");
  if (row.booking.status !== "arrived") throw new Error("يمكن إرسال التقييم بعد تسجيل حضور العميل وإتمام الخدمة");
  const existing = await db.select({ id: bookingReviews.id }).from(bookingReviews).where(eq(bookingReviews.bookingId, input.bookingId)).limit(1);
  if (existing.length) throw new Error("تم إرسال تقييم لهذا الحجز من قبل");
  const staffRow = (await db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, row.booking.staffId), eq(staff.tenantId, catalog.tenant.id))).limit(1))[0];
  if (!staffRow) throw new Error("الموظف المرتبط بالحجز غير موجود");
  await db.insert(bookingReviews).values({ tenantId: catalog.tenant.id, bookingId: input.bookingId, clientId: row.client.id, staffId: staffRow.id, rating: input.rating, comment: input.comment?.trim() || null, published: 1 });
  return { ok: true };
}

export async function createWorkspaceBooking(userId: number, role: string, input: { tenantId: number; clientName: string; phone: string; serviceId: number; staffId: number; date: string; startMinutes: number; note?: string }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const tenant = (await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1))[0];
  const service = (await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.tenantId, input.tenantId), eq(services.active, 1))).limit(1))[0];
  const selectedStaff = (await db.select().from(staff).where(and(eq(staff.id, input.staffId), eq(staff.tenantId, input.tenantId), eq(staff.active, 1))).limit(1))[0];
  if (!tenant || !service || !selectedStaff) throw new Error("الخدمة أو الموظف غير متاح");
  const endMinutes = input.startMinutes + service.durationMinutes;
  if (input.startMinutes < tenant.openMinutes || endMinutes > tenant.closeMinutes) throw new Error("الموعد خارج ساعات العمل");
  const conflict = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.tenantId, input.tenantId), eq(bookings.staffId, input.staffId), eq(bookings.date, input.date), ne(bookings.status, "cancelled"), lt(bookings.startMinutes, endMinutes), gt(sql`${bookings.startMinutes} + ${bookings.durationMinutes}`, input.startMinutes))).limit(1);
  if (conflict.length) throw new Error("هذا الموظف لديه حجز في نفس الوقت");
  let client = (await db.select().from(clients).where(and(eq(clients.tenantId, input.tenantId), eq(clients.phone, input.phone))).limit(1))[0];
  if (!client) { const result = await db.insert(clients).values({ tenantId: input.tenantId, name: input.clientName, phone: input.phone }); client = (await db.select().from(clients).where(eq(clients.id, Number(result[0].insertId))).limit(1))[0]; }
  else if (client.name !== input.clientName) await db.update(clients).set({ name: input.clientName }).where(eq(clients.id, client.id));
  const result = await db.insert(bookings).values({ tenantId: input.tenantId, clientId: client.id, staffId: input.staffId, serviceId: service.id, date: input.date, startMinutes: input.startMinutes, durationMinutes: service.durationMinutes, totalPrice: service.price, status: "confirmed", source: "dashboard", paid: 0, note: input.note });
  const bookingId = Number(result[0].insertId);
  await db.insert(bookingItems).values({ tenantId: input.tenantId, bookingId, serviceId: service.id, staffId: selectedStaff.id, durationMinutes: service.durationMinutes, price: service.price });
  await db.insert(notifications).values({ tenantId: input.tenantId, title: "حجز من الاستقبال", body: `تم إنشاء حجز للعميل ${input.clientName}` });
  await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: userId, action: "booking.created.reception", entity: "booking", entityId: bookingId });
  return { bookingId };
}


export async function listProductsForTenant(userId: number, role: string, tenantId: number) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  return db.select().from(products).where(and(eq(products.tenantId, tenantId), eq(products.active, 1))).orderBy(products.name);
}

export async function addProduct(userId: number, role: string, input: { tenantId: number; name: string; category?: string; sku?: string; salePrice: number; costPrice: number; stock: number; lowStockAt: number }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const result = await db.insert(products).values({ ...input, category: input.category || "عام", sku: input.sku || undefined, active: 1 });
  const productId = Number(result[0].insertId);
  await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: userId, action: "product.created", entity: "product", entityId: productId });
  return { productId };
}

export async function sellProduct(userId: number, role: string, input: { tenantId: number; productId: number; staffId: number; quantity: number; bookingId?: number; clientId?: number }) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, input.tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  if (input.quantity < 1) throw new Error("الكمية يجب أن تكون أكبر من صفر");
  const product = (await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.tenantId, input.tenantId), eq(products.active, 1))).limit(1))[0];
  const person = (await db.select().from(staff).where(and(eq(staff.id, input.staffId), eq(staff.tenantId, input.tenantId), eq(staff.active, 1))).limit(1))[0];
  if (!product || !person) throw new Error("المنتج أو الموظف غير متاح");
  if (product.stock < input.quantity) throw new Error(`المخزون غير كافٍ. المتاح: ${product.stock}`);
  const totalPrice = product.salePrice * input.quantity;
  const commissionBase = person.commissionBasis === "net" ? Math.max(0, product.salePrice - product.costPrice) * input.quantity : totalPrice;
  const commissionAmount = Math.floor(commissionBase * person.commissionRate / 100);
  const result = await db.insert(productSales).values({ tenantId: input.tenantId, productId: product.id, staffId: person.id, quantity: input.quantity, unitPrice: product.salePrice, totalPrice, commissionRate: person.commissionRate, commissionAmount, bookingId: input.bookingId, clientId: input.clientId });
  await db.update(products).set({ stock: product.stock - input.quantity }).where(eq(products.id, product.id));
  await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: userId, action: "product.sale.created", entity: "product_sale", entityId: Number(result[0].insertId) });
  await db.insert(notifications).values({ tenantId: input.tenantId, title: "بيع منتج", body: `تم تسجيل بيع ${input.quantity} × ${product.name} باسم ${person.name}` });
  return { totalPrice, commissionAmount, remainingStock: product.stock - input.quantity };
}

export async function getStaffPayroll(userId: number, role: string, tenantId: number, from: string, to: string) {
  const db = await getDb(); if (!db || !(await canAccessTenant(userId, role, tenantId))) throw new Error("لا تملك صلاحية لهذه الشركة");
  const [people, serviceRows, saleRows] = await Promise.all([
    db.select().from(staff).where(eq(staff.tenantId, tenantId)),
    db.select({ booking: bookings, staff }).from(bookings).innerJoin(staff, eq(staff.id, bookings.staffId)).where(and(eq(bookings.tenantId, tenantId), gte(bookings.date, from), lte(bookings.date, to))),
    db.select({ sale: productSales, staff }).from(productSales).innerJoin(staff, eq(staff.id, productSales.staffId)).where(and(eq(productSales.tenantId, tenantId), gte(sql`DATE(${productSales.createdAt})`, from), lte(sql`DATE(${productSales.createdAt})`, to))),
  ]);
  return people.map(person => {
    const serviceTotal = serviceRows.filter(row => row.staff.id === person.id && row.booking.status !== "cancelled" && row.booking.status !== "no_show").reduce((sum, row) => sum + row.booking.totalPrice, 0);
    const serviceCommission = Math.floor(serviceTotal * person.commissionRate / 100);
    const sales = saleRows.filter(row => row.staff.id === person.id);
    const productTotal = sales.reduce((sum, row) => sum + row.sale.totalPrice, 0);
    const productCommission = sales.reduce((sum, row) => sum + row.sale.commissionAmount, 0);
    return { staffId: person.id, name: person.name, role: person.role, commissionRate: person.commissionRate, commissionBasis: person.commissionBasis, serviceTotal, serviceCommission, productTotal, productCommission, totalSales: serviceTotal + productTotal, totalCommission: serviceCommission + productCommission };
  });
}
