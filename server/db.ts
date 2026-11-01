import { and, desc, eq, gte, lte } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, User, auditLogs, bookingItems, bookingReviews, bookings, clients, expenses, notifications, services, staff, staffInvites, staffTimeOff, staffWorkingHours, tenants, tenantMembers, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (['name', 'email', 'loginMethod'] as const).forEach(field => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  values.lastSignedIn ??= new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
export async function listTenants() { const db = await getDb(); return db ? db.select().from(tenants).orderBy(desc(tenants.createdAt)) : []; }
export async function setTenantStatus(tenantId:number,status:"active"|"trial"|"suspended",actorUserId:number) { const db=await getDb(); if(!db) throw new Error("Database is not available"); await db.update(tenants).set({status}).where(eq(tenants.id,tenantId)); await db.insert(auditLogs).values({tenantId,actorUserId,action:`tenant.${status}`,entity:"tenant",entityId:tenantId}); return (await db.select().from(tenants).where(eq(tenants.id,tenantId)).limit(1))[0]; }
export async function createTenantForUser(userId: number, input: {name:string; slug:string; city?:string; currency?:string}) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  try {
    return await db.transaction(async tx => {
      const existing = await tx.select({id:tenants.id}).from(tenants).where(eq(tenants.slug, input.slug)).limit(1);
      if (existing[0]) throw new Error("رابط الشركة مستخدم بالفعل، اختر اسماً آخر");
      const tenantResult = await tx.insert(tenants).values({name:input.name.trim(), slug:input.slug, city:input.city?.trim() || null, currency:input.currency ?? "ر.ع", status:"trial"});
      const tenantId = Number(tenantResult[0].insertId);
      await tx.insert(tenantMembers).values({tenantId, userId, role:"owner"});
      return (await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1))[0];
    });
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) throw new Error("رابط الشركة مستخدم بالفعل، اختر اسماً آخر");
    throw error;
  }
}
export async function listBookings(tenantId: number, date: string) {
  const db = await getDb();
  return db ? db.select().from(bookings).where(and(eq(bookings.tenantId, tenantId), eq(bookings.date, date))).orderBy(bookings.startMinutes) : [];
}
export async function listTenantClients(tenantId:number) {
  const db=await getDb(); if(!db) return [];
  const rows=await db.select().from(clients).where(eq(clients.tenantId,tenantId)).orderBy(clients.name);
  return rows;
}
export async function getTenantClientProfile(tenantId:number,clientId:number) {
  const db=await getDb(); if(!db) throw new Error("Database is not available");
  const client=(await db.select().from(clients).where(and(eq(clients.id,clientId),eq(clients.tenantId,tenantId))).limit(1))[0];
  if(!client) throw new Error("العميل غير موجود في هذه الشركة");
  const rows=await db.select({booking:bookings,service:services,staff}).from(bookings)
    .innerJoin(services,and(eq(bookings.serviceId,services.id),eq(services.tenantId,tenantId)))
    .innerJoin(staff,and(eq(bookings.staffId,staff.id),eq(staff.tenantId,tenantId)))
    .where(and(eq(bookings.tenantId,tenantId),eq(bookings.clientId,clientId)))
    .orderBy(desc(bookings.date),desc(bookings.startMinutes));
  const history=rows.map(row=>({...row.booking,serviceName:row.service.name,staffName:row.staff.name}));
  return {client,bookings:history,visitCount:history.filter(item=>item.status==="completed").length,paidTotal:history.filter(item=>item.paid===1).reduce((sum,item)=>sum+item.totalPrice,0)};
}
export async function listDetailedBookings(tenantId:number,date:string) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({booking:bookings, client:clients, service:services, staff}).from(bookings)
    .innerJoin(clients, eq(bookings.clientId, clients.id)).innerJoin(services, eq(bookings.serviceId, services.id)).innerJoin(staff, eq(bookings.staffId, staff.id))
    .where(and(eq(bookings.tenantId,tenantId),eq(bookings.date,date))).orderBy(bookings.startMinutes);
  return rows.map(row => ({...row.booking, clientName:row.client.name, clientPhone:row.client.phone ?? "", serviceName:row.service.name, durationMinutes:row.booking.durationMinutes ?? row.service.durationMinutes, price:row.booking.totalPrice ?? row.service.price, staffName:row.staff.name}));
}
export function isTenantPublicBookingEnabled(status: "active" | "trial" | "suspended"): boolean {
  return status !== "suspended";
}

export function isValidTenantTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a local wall-clock time to a UTC instant only when it is unambiguous.
 * DST gaps resolve to no candidates; DST overlaps resolve to two candidates.
 */
function getUniqueLocalBookingInstant(date: string, minutes: number, timeZone: string): number | null {
  if (!isValidBookingDate(date) || !Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return null;
  try {
    const [year, month, day] = date.split("-").map(Number);
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const offsets = new Set<number>();
    for (let delta = -36; delta <= 36; delta += 6) {
      const sample = wallClockAsUtc + delta * 60 * 60 * 1000;
      const parts = formatter.formatToParts(new Date(sample));
      const part = (type: string) => Number(parts.find(item => item.type === type)?.value ?? 0);
      const representedAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
      offsets.add(representedAsUtc - sample);
    }
    const matches: number[] = [];
    for (const offset of offsets) {
      const candidate = wallClockAsUtc - offset;
      const parts = formatter.formatToParts(new Date(candidate));
      const part = (type: string) => Number(parts.find(item => item.type === type)?.value ?? 0);
      if (
        part("year") === year && part("month") === month && part("day") === day &&
        part("hour") === hour && part("minute") === minute && part("second") === 0
      ) matches.push(candidate);
    }
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}

/**
 * A booking interval must preserve its advertised elapsed duration in real time.
 * Both local endpoints must be unambiguous and their UTC difference must match
 * the configured duration; otherwise DST would shorten or lengthen the service.
 */
export function isLocalBookingIntervalValid(date: string, startMinutes: number, durationMinutes: number, timeZone: string): boolean {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) return false;
  if (!Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes + durationMinutes > 1440) return false;
  const startInstant = getUniqueLocalBookingInstant(date, startMinutes, timeZone);
  if (startInstant === null) return false;

  const endTotalMinutes = startMinutes + durationMinutes;
  const endDate = endTotalMinutes === 1440
    ? new Date(Date.parse(date + "T00:00:00.000Z") + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : date;
  const endMinutes = endTotalMinutes === 1440 ? 0 : endTotalMinutes;
  const endInstant = getUniqueLocalBookingInstant(endDate, endMinutes, timeZone);
  return endInstant !== null && endInstant - startInstant === durationMinutes * 60 * 1000;
}

export function isUniqueLocalBookingStart(date: string, startMinutes: number, timeZone: string): boolean {
  return getUniqueLocalBookingInstant(date, startMinutes, timeZone) !== null;
}

export function isBookingStartInFuture(date: string, startMinutes: number, timeZone: string, now = new Date()): boolean {
  try {
    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (type: string) => dateParts.find(item => item.type === type)?.value ?? "";
    const localDate = `${part("year")}-${part("month")}-${part("day")}`;
    if (date !== localDate) return date > localDate;

    const timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const timePart = (type: string) => Number(timeParts.find(item => item.type === type)?.value ?? 0);
    const currentMinutes = timePart("hour") * 60 + timePart("minute");
    return Number.isInteger(startMinutes) && startMinutes > currentMinutes;
  } catch {
    return false;
  }
}

export function isValidBookingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function hasBookingConflict(
  existing: Array<{id:number;startMinutes:number;durationMinutes:number;status:string}>,
  candidate: {startMinutes:number;durationMinutes:number},
  excludeBookingId?: number,
): boolean {
  const candidateEnd = candidate.startMinutes + candidate.durationMinutes;
  return existing.some(item =>
    item.id !== excludeBookingId &&
    item.status !== "cancelled" &&
    candidate.startMinutes < item.startMinutes + item.durationMinutes &&
    item.startMinutes < candidateEnd
  );
}

export async function updateBookingForTenant(tenantId:number, bookingId:number, patch:{status?:"new"|"confirmed"|"arrived"|"completed"|"cancelled"|"no_show";paid?:boolean;note?:string;durationMinutes?:number;staffId?:number;startMinutes?:number;date?:string}, actorUserId:number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
  await tx.select({id:tenants.id}).from(tenants).where(eq(tenants.id,tenantId)).for("update");

  const rows = await tx.select().from(bookings).where(and(eq(bookings.id,bookingId),eq(bookings.tenantId,tenantId))).limit(1); const booking = rows[0];
  if (!booking) throw new Error("الحجز غير موجود");
  if (patch.status === "cancelled" && booking.paid) throw new Error("لا يمكن إلغاء حجز مدفوع قبل معالجة الاسترجاع المالي");

  const nextDate = patch.date ?? booking.date;
  const nextStaffId = patch.staffId ?? booking.staffId;
  const nextStart = patch.startMinutes ?? booking.startMinutes;
  const nextDuration = patch.durationMinutes ?? booking.durationMinutes;
  if (!isValidBookingDate(nextDate)) throw new Error("تاريخ الحجز غير صحيح");
  if (!Number.isInteger(nextStart) || nextStart < 0 || nextStart > 1439) throw new Error("وقت بداية الحجز غير صحيح");
  if (!Number.isInteger(nextDuration) || nextDuration < 15 || nextDuration > 480) throw new Error("مدة الحجز يجب أن تكون بين 15 و480 دقيقة");
  if (nextStart + nextDuration > 1440) throw new Error("وقت نهاية الحجز يتجاوز نهاية اليوم");
  const nextStaff = (await tx.select({id:staff.id}).from(staff).where(and(eq(staff.id,nextStaffId),eq(staff.tenantId,tenantId),eq(staff.active,1))).limit(1))[0];
  if (!nextStaff) throw new Error("الموظف المحدد غير موجود أو غير نشط في هذا النشاط");

  const movingAppointment = patch.date !== undefined || patch.staffId !== undefined || patch.startMinutes !== undefined || patch.durationMinutes !== undefined;
  if (movingAppointment && patch.status !== "cancelled") {
    const tenant = (await tx.select({ timezone: tenants.timezone }).from(tenants).where(eq(tenants.id, tenantId)).limit(1))[0];
    if (!tenant || !isLocalBookingIntervalValid(nextDate, nextStart, nextDuration, tenant.timezone || "Asia/Muscat")) {
      throw new Error("مدة الحجز تتعارض مع تغيير التوقيت الصيفي؛ اختر موعدًا آخر");
    }
    const weekday = new Date(nextDate + "T00:00:00Z").getUTCDay();
    const timeOff = await tx.select({id:staffTimeOff.id}).from(staffTimeOff).where(and(eq(staffTimeOff.tenantId,tenantId),eq(staffTimeOff.staffId,nextStaffId),eq(staffTimeOff.date,nextDate))).limit(1);
    if (timeOff.length) throw new Error("الموظف في إجازة في هذا اليوم");
    const workingHours = await tx.select().from(staffWorkingHours).where(and(
      eq(staffWorkingHours.tenantId, tenantId),
      eq(staffWorkingHours.staffId, nextStaffId),
      eq(staffWorkingHours.weekday, weekday),
      eq(staffWorkingHours.active, 1),
    ));
    if (!isWithinStaffWorkingHours(weekday, nextStart, nextDuration, workingHours)) {
      throw new Error("الموعد الجديد خارج ساعات عمل الموظف، اختر وقتاً ضمن ساعات العمل");
    }

    const sameDay = await tx.select().from(bookings).where(and(eq(bookings.tenantId,tenantId),eq(bookings.staffId,nextStaffId),eq(bookings.date,nextDate)));
    const conflict = hasBookingConflict(sameDay, {startMinutes:nextStart, durationMinutes:nextDuration}, bookingId);
    if (conflict) throw new Error("هذا الموظف لديه حجز آخر في الوقت المحدد، اختر وقتاً مختلفاً");
  }

  const set: Partial<typeof bookings.$inferInsert> = {};
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.status === "completed") set.completedAt = new Date();
  if (patch.paid !== undefined) set.paid = patch.paid ? 1 : 0;
  if (patch.note !== undefined) set.note = patch.note;
  if (patch.durationMinutes !== undefined) set.durationMinutes = nextDuration;
  if (patch.staffId !== undefined) set.staffId = nextStaffId;
  if (patch.startMinutes !== undefined) set.startMinutes = nextStart;
  if (patch.date !== undefined) set.date = nextDate;
  await tx.update(bookings).set(set).where(and(eq(bookings.id,bookingId),eq(bookings.tenantId,tenantId)));
  const action = patch.status === "cancelled" ? "booking.cancelled" : patch.status === "completed" ? "booking.completed" : patch.paid ? "booking.paid" : "booking.updated";
  await tx.insert(auditLogs).values({tenantId,actorUserId,action,entity:"booking",entityId:bookingId});
  await tx.insert(notifications).values({tenantId,recipientStaffId:nextStaffId,type:action,title:action === "booking.cancelled" ? "تم إلغاء حجز" : action === "booking.completed" ? "اكتملت الخدمة" : "تحديث على حجز",body:`تم تحديث حجز العميل رقم ${bookingId}.`,entity:"booking",entityId:bookingId});
  return (await tx.select().from(bookings).where(eq(bookings.id,bookingId)).limit(1))[0];
  });
}
export async function listNotifications(tenantId:number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.tenantId,tenantId)).orderBy(desc(notifications.createdAt)).limit(20);
}
export async function getEmployeeReports(tenantId:number,fromDate:string,toDate:string) {
  const db = await getDb(); if (!db) return {employees:[],totals:{bookings:0,completed:0,cancelled:0,revenue:0,paidRevenue:0}};
  const staffRows = await db.select().from(staff).where(eq(staff.tenantId,tenantId));
  const rows = await db.select({booking:bookings,service:services}).from(bookings).innerJoin(services,eq(bookings.serviceId,services.id)).where(and(eq(bookings.tenantId,tenantId),gte(bookings.date,fromDate),lte(bookings.date,toDate)));
  const employees = staffRows.map(person => { const mine=rows.filter(row=>row.booking.staffId===person.id); const active=mine.filter(row=>row.booking.status!=="cancelled"); return {id:person.id,name:person.name,role:person.role,bookings:mine.length,completed:mine.filter(row=>row.booking.status==="completed" || row.booking.status==="arrived").length,cancelled:mine.filter(row=>row.booking.status==="cancelled").length,noShow:mine.filter(row=>row.booking.status==="no_show").length,revenue:active.reduce((sum,row)=>sum+(row.booking.totalPrice || row.service.price),0),paidRevenue:active.filter(row=>row.booking.paid).reduce((sum,row)=>sum+(row.booking.totalPrice || row.service.price),0)}; });
  return {employees,totals:employees.reduce((total,row)=>({bookings:total.bookings+row.bookings,completed:total.completed+row.completed,cancelled:total.cancelled+row.cancelled,revenue:total.revenue+row.revenue,paidRevenue:total.paidRevenue+row.paidRevenue}),{bookings:0,completed:0,cancelled:0,revenue:0,paidRevenue:0})};
}
export async function listExpenses(tenantId:number,fromDate:string,toDate:string) { const db=await getDb(); return db ? db.select().from(expenses).where(and(eq(expenses.tenantId,tenantId),gte(expenses.date,fromDate),lte(expenses.date,toDate))).orderBy(desc(expenses.date),desc(expenses.id)) : []; }
export async function createExpense(tenantId:number,createdBy:number,input:{category:string;description:string;vendor?:string;amount:number;date:string;paymentMethod:string}) { const db=await getDb(); if(!db) throw new Error("Database is not available"); const result=await db.insert(expenses).values({...input,tenantId,createdBy,vendor:input.vendor || null}); const id=Number(result[0].insertId); await db.insert(auditLogs).values({tenantId,actorUserId:createdBy,action:"expense.created",entity:"expense",entityId:id}); return (await db.select().from(expenses).where(eq(expenses.id,id)).limit(1))[0]; }
export async function getTenantForUser(user: User) {
  const db = await getDb(); if (!db) return undefined;
  const rows = await db.select({ tenant: tenants }).from(tenantMembers).innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id)).where(eq(tenantMembers.userId, user.id)).limit(1);
  if (rows[0]?.tenant) return rows[0].tenant;
  if (user.role === "admin") return (await db.select().from(tenants).orderBy(desc(tenants.createdAt)).limit(1))[0];
  return undefined;
}
export async function userCanAccessTenant(user: User, tenantId: number) {
  if (user.role === "admin") return true;
  const db = await getDb(); if (!db) return false;
  const rows = await db.select({ id: tenantMembers.id }).from(tenantMembers).where(and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, tenantId))).limit(1);
  return rows.length > 0;
}
export async function userCanManageTenant(user: User, tenantId: number) {
  if (user.role === "admin") return true;
  const db = await getDb(); if (!db) return false;
  const rows = await db.select({ role: tenantMembers.role }).from(tenantMembers)
    .where(and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, tenantId))).limit(1);
  return rows[0]?.role === "owner" || rows[0]?.role === "manager";
}
export async function getPublicBookingCatalog(slug: string) {
  const db = await getDb(); if (!db) return undefined;
  const tenantRows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  const tenant = tenantRows[0]; if (!tenant || !isTenantPublicBookingEnabled(tenant.status)) return undefined;
  const [serviceRows, staffRows, reviewRows] = await Promise.all([
    db.select().from(services).where(and(eq(services.tenantId, tenant.id), eq(services.active, 1))),
    db.select().from(staff).where(and(eq(staff.tenantId, tenant.id), eq(staff.active, 1))),
    db.select().from(bookingReviews).where(and(eq(bookingReviews.tenantId, tenant.id), eq(bookingReviews.published, 1))).orderBy(desc(bookingReviews.createdAt)),
  ]);
  const staffWithRatings = staffRows.map(person => { const mine=reviewRows.filter(review=>review.staffId===person.id); const rating=mine.length ? mine.reduce((sum,item)=>sum+item.rating,0)/mine.length : 0; return {...person,rating,reviewCount:mine.length}; });
  return { tenant, services: serviceRows, staff: staffWithRatings, reviews: reviewRows };
}
export function isWithinStaffWorkingHours(
  weekday: number,
  startMinutes: number,
  durationMinutes: number,
  hours: Array<{ weekday: number; openMinutes: number; closeMinutes: number; active: number }>,
): boolean {
  const schedule = hours.find(item => item.weekday === weekday && item.active === 1);
  return !!schedule &&
    Number.isInteger(startMinutes) &&
    Number.isInteger(durationMinutes) &&
    startMinutes >= schedule.openMinutes &&
    startMinutes + durationMinutes <= schedule.closeMinutes;
}

export function buildAvailableBookingSlots(input: {
  weekday: number;
  openMinutes: number;
  closeMinutes: number;
  durationMinutes: number;
  existingBookings: Array<{ id: number; startMinutes: number; durationMinutes: number; status: string }>;
  isFuture: (startMinutes: number) => boolean;
}): number[] {
  const slots: number[] = [];
  if (input.durationMinutes < 1 || input.openMinutes < 0 || input.closeMinutes > 1440 || input.closeMinutes <= input.openMinutes) return slots;
  const firstSlot = Math.ceil(input.openMinutes / 30) * 30;
  for (let start = firstSlot; start + input.durationMinutes <= input.closeMinutes; start += 30) {
    if (input.isFuture(start) && !hasBookingConflict(input.existingBookings, { startMinutes: start, durationMinutes: input.durationMinutes })) {
      slots.push(start);
    }
  }
  return slots;
}

export async function getPublicBookingSlots(input: { slug: string; staffId: number; serviceIds: number[]; date: string }): Promise<number[]> {
  const db = await getDb();
  if (!db || !isValidBookingDate(input.date) || !input.serviceIds.length) return [];
  const tenant = (await db.select().from(tenants).where(eq(tenants.slug, input.slug)).limit(1))[0];
  if (!tenant || !isTenantPublicBookingEnabled(tenant.status)) return [];
  const member = (await db.select().from(staff).where(and(eq(staff.id, input.staffId), eq(staff.tenantId, tenant.id), eq(staff.active, 1))).limit(1))[0];
  if (!member) return [];
  const ids = Array.from(new Set(input.serviceIds));
  const serviceRows = await db.select().from(services).where(and(eq(services.tenantId, tenant.id), eq(services.active, 1)));
  const selectedServices = ids.map(id => serviceRows.find(item => item.id === id)).filter(Boolean) as typeof serviceRows;
  if (selectedServices.length !== ids.length) return [];
  const durationMinutes = selectedServices.reduce((sum, item) => sum + item.durationMinutes, 0);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) return [];
  const weekday = new Date(input.date + "T00:00:00Z").getUTCDay();
  const [hoursRows, existingBookings, timeOffRows] = await Promise.all([
    db.select().from(staffWorkingHours).where(and(eq(staffWorkingHours.tenantId, tenant.id), eq(staffWorkingHours.staffId, input.staffId), eq(staffWorkingHours.weekday, weekday), eq(staffWorkingHours.active, 1))),
    db.select().from(bookings).where(and(eq(bookings.tenantId, tenant.id), eq(bookings.staffId, input.staffId), eq(bookings.date, input.date))),
    db.select().from(staffTimeOff).where(and(eq(staffTimeOff.tenantId,tenant.id),eq(staffTimeOff.staffId,input.staffId),eq(staffTimeOff.date,input.date))),
  ]);
  const hours = hoursRows[0];
  if (!hours || timeOffRows.length) return [];
  return buildAvailableBookingSlots({
    weekday,
    openMinutes: hours.openMinutes,
    closeMinutes: hours.closeMinutes,
    durationMinutes,
    existingBookings,
    isFuture: startMinutes => isLocalBookingIntervalValid(input.date, startMinutes, durationMinutes, tenant.timezone || "Asia/Muscat") && isBookingStartInFuture(input.date, startMinutes, tenant.timezone || "Asia/Muscat"),
  });
}

export async function getPublicBookingSlotsByStaff(input: { slug: string; serviceIds: number[]; date: string }) {
  const catalog = await getPublicBookingCatalog(input.slug);
  if (!catalog || !input.serviceIds.length) return [];
  return Promise.all(catalog.staff.map(async member => ({
    id: member.id, name: member.name, role: member.role, color: member.color,
    photoUrl: member.photoUrl, rating: member.rating, reviewCount: member.reviewCount,
    slots: await getPublicBookingSlots({ slug: input.slug, staffId: member.id, serviceIds: input.serviceIds, date: input.date }),
  })));
}

export async function createPublicBooking(input: {slug:string; clientName:string; phone:string; serviceId:number; serviceIds?:number[]; staffId:number; date:string; startMinutes:number; note?:string; idempotencyKey:string}) {
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 64) {
    throw new Error("مفتاح الحجز غير صالح");
  }
  const normalizedRequest = { slug:input.slug, clientName:input.clientName.trim(), phone:input.phone.trim(), serviceIds:Array.from(new Set(input.serviceIds?.length ? input.serviceIds : [input.serviceId])), staffId:input.staffId, date:input.date, startMinutes:input.startMinutes, note:input.note ?? "" };
  const requestHash = createHash("sha256").update(JSON.stringify(normalizedRequest)).digest("hex");
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
  await tx.select({id:tenants.id}).from(tenants).where(eq(tenants.slug,input.slug)).for("update");

  const tenantRows = await tx.select().from(tenants).where(eq(tenants.slug, input.slug)).limit(1);
  const tenant = tenantRows[0]; if (!tenant) throw new Error("Company not found");
  const previousRows = await tx.select().from(bookings).where(and(eq(bookings.tenantId, tenant.id), eq(bookings.idempotencyKey, idempotencyKey))).limit(1);
  if (previousRows[0]) {
    const previous = previousRows[0];
    if (previous.requestHash !== requestHash) throw new Error("مفتاح الحجز مستخدم لبيانات مختلفة؛ أعد تحميل الصفحة وحاول مجددًا");
    const previousItems = await tx.select({name:services.name}).from(bookingItems).innerJoin(services, eq(bookingItems.serviceId, services.id)).where(and(eq(bookingItems.tenantId, tenant.id), eq(bookingItems.bookingId, previous.id)));
    return { id:previous.id, bookingId:previous.id, tenantId:tenant.id, tenantName:tenant.name, serviceName:previousItems.map(item=>item.name).join(" + "), totalDuration:previous.durationMinutes, totalPrice:previous.totalPrice };
  }
   if (!isTenantPublicBookingEnabled(tenant.status)) throw new Error("الحجوزات العامة متوقفة لهذا النشاط");
  const ids = Array.from(new Set(input.serviceIds?.length ? input.serviceIds : [input.serviceId]));
  const serviceRows = await tx.select().from(services).where(and(eq(services.tenantId, tenant.id), eq(services.active, 1)));
  const selectedServices = ids.map(id => serviceRows.find(item => item.id === id)).filter(Boolean) as typeof serviceRows;
  if (selectedServices.length !== ids.length) throw new Error("Service not found");
  const totalDuration = selectedServices.reduce((sum,item)=>sum+item.durationMinutes,0); const totalPrice = selectedServices.reduce((sum,item)=>sum+item.price,0);
  if (!Number.isInteger(totalDuration) || totalDuration < 1 || totalDuration > 480) throw new Error("إجمالي مدة الخدمات يجب ألا يتجاوز 480 دقيقة");
  if (!isValidBookingDate(input.date)) throw new Error("تاريخ الحجز غير صحيح");
  if (!isLocalBookingIntervalValid(input.date, input.startMinutes, totalDuration, tenant.timezone || "Asia/Muscat")) throw new Error("مدة الخدمة تتعارض مع تغيير التوقيت الصيفي؛ اختر موعدًا آخر");
  if (!isBookingStartInFuture(input.date, input.startMinutes, tenant.timezone || "Asia/Muscat")) throw new Error("اختر موعدًا في المستقبل حسب التوقيت المحلي للنشاط");
  if (!Number.isInteger(input.startMinutes) || input.startMinutes < 0 || input.startMinutes > 1439 || input.startMinutes + totalDuration > 1440) throw new Error("وقت الحجز خارج حدود اليوم");
  const staffRows = await tx.select().from(staff).where(and(eq(staff.id, input.staffId), eq(staff.tenantId, tenant.id), eq(staff.active, 1))).limit(1);
  if (!staffRows[0]) throw new Error("Staff not found");
  const timeOffRows = await tx.select({id:staffTimeOff.id}).from(staffTimeOff).where(and(eq(staffTimeOff.tenantId, tenant.id), eq(staffTimeOff.staffId, input.staffId), eq(staffTimeOff.date, input.date))).limit(1);
  if (timeOffRows.length) throw new Error("الموظف في إجازة في هذا اليوم");
  const weekday = new Date(input.date + "T00:00:00Z").getUTCDay();
  const staffHours = await tx.select().from(staffWorkingHours).where(and(eq(staffWorkingHours.tenantId, tenant.id), eq(staffWorkingHours.staffId, input.staffId), eq(staffWorkingHours.weekday, weekday), eq(staffWorkingHours.active, 1))).limit(1);
  if (!isWithinStaffWorkingHours(weekday, input.startMinutes, totalDuration, staffHours)) throw new Error("الموعد خارج ساعات عمل الموظف");
  const existing = await tx.select().from(bookings).where(and(eq(bookings.tenantId, tenant.id), eq(bookings.staffId, input.staffId), eq(bookings.date, input.date)));
  const overlaps = hasBookingConflict(existing, {startMinutes:input.startMinutes, durationMinutes:totalDuration});
  if (overlaps) throw new Error("هذا الوقت محجوز بالفعل، اختر وقتاً آخر");
  const clientRows = await tx.select().from(clients).where(and(eq(clients.tenantId, tenant.id), eq(clients.phone, input.phone))).limit(1);
  let clientId = clientRows[0]?.id;
  if (!clientId) {
    const result = await tx.insert(clients).values({tenantId:tenant.id, name:input.clientName, phone:input.phone, visits:0, totalSpent:0, lastVisit:input.date});
    clientId = Number(result[0].insertId);
  }
  const result = await tx.insert(bookings).values({tenantId:tenant.id, clientId, staffId:input.staffId, serviceId:selectedServices[0].id, date:input.date, startMinutes:input.startMinutes, durationMinutes:totalDuration, totalPrice, status:"new", source:"online", paid:0, note:input.note ?? null, idempotencyKey, requestHash});
  const bookingId = Number(result[0].insertId);
  await tx.insert(bookingItems).values(selectedServices.map(item => ({tenantId:tenant.id,bookingId,serviceId:item.id,staffId:input.staffId,durationMinutes:item.durationMinutes,price:item.price})));
  await tx.insert(auditLogs).values({tenantId:tenant.id,actorUserId:null,action:"booking.created",entity:"booking",entityId:bookingId});
  await tx.insert(notifications).values({tenantId:tenant.id,recipientStaffId:input.staffId,type:"booking.created",title:"حجز أونلاين جديد",body:`تم حجز ${selectedServices.map(item=>item.name).join(" + ")} للعميل ${input.clientName}.`,entity:"booking",entityId:bookingId});
  return { id: bookingId, bookingId, tenantId: tenant.id, tenantName: tenant.name, serviceName: selectedServices.map(item=>item.name).join(" + "), totalDuration, totalPrice };
  });
}
export async function createBookingReview(input:{tenantId:number;bookingId:number;phone:string;rating:number;comment?:string}) {
  const db=await getDb(); if(!db) throw new Error("Database is not available");
  if(input.rating<1 || input.rating>5) throw new Error("التقييم يجب أن يكون بين نجمة و5 نجوم");
  const booking=(await db.select().from(bookings).where(and(eq(bookings.id,input.bookingId),eq(bookings.tenantId,input.tenantId))).limit(1))[0];
  if(!booking || booking.status!=="completed") throw new Error("يمكن تقييم الحجز بعد اكتمال الخدمة فقط");
  const client=(await db.select().from(clients).where(and(eq(clients.id,booking.clientId),eq(clients.tenantId,input.tenantId))).limit(1))[0];
  if(!client || client.phone !== input.phone) throw new Error("رقم الهاتف لا يطابق بيانات الحجز");
  const existing=(await db.select().from(bookingReviews).where(eq(bookingReviews.bookingId,input.bookingId)).limit(1))[0]; if(existing) throw new Error("تم تقييم هذا الحجز من قبل");
  const result=await db.insert(bookingReviews).values({tenantId:input.tenantId,bookingId:booking.id,clientId:booking.clientId,staffId:booking.staffId,rating:input.rating,comment:input.comment||null,published:0});
  return (await db.select().from(bookingReviews).where(eq(bookingReviews.id,Number(result[0].insertId))).limit(1))[0];
}
export async function listBookingReviews(tenantId:number) { const db=await getDb(); return db ? db.select().from(bookingReviews).where(eq(bookingReviews.tenantId,tenantId)).orderBy(desc(bookingReviews.createdAt)) : []; }
export async function publishBookingReview(tenantId:number,reviewId:number,published:boolean) { const db=await getDb(); if(!db) throw new Error("Database is not available"); await db.update(bookingReviews).set({published:published?1:0}).where(and(eq(bookingReviews.id,reviewId),eq(bookingReviews.tenantId,tenantId))); return (await db.select().from(bookingReviews).where(eq(bookingReviews.id,reviewId)).limit(1))[0]; }
export async function updateTenantSettings(tenantId:number,input:{countryCode?:string;currency?:string;timezone?:string;defaultLanguage?:string}) { const db=await getDb(); if(!db) throw new Error("Database is not available"); if (input.timezone !== undefined && !isValidTenantTimeZone(input.timezone)) throw new Error("المنطقة الزمنية غير صحيحة؛ اختر منطقة زمنية معتمدة مثل Asia/Muscat"); await db.update(tenants).set(input).where(eq(tenants.id,tenantId)); return (await db.select().from(tenants).where(eq(tenants.id,tenantId)).limit(1))[0]; }
export async function listTenantServices(tenantId:number) { const db=await getDb(); return db ? db.select().from(services).where(and(eq(services.tenantId,tenantId),eq(services.active,1))).orderBy(services.id) : []; }
export async function createTenantService(tenantId:number,input:{name:string;category:string;durationMinutes:number;price:number}) { const db=await getDb(); if(!db) throw new Error("Database is not available"); if(!input.name.trim()||input.name.trim().length>160) throw new Error("اسم الخدمة غير صحيح"); if(!Number.isInteger(input.durationMinutes)||input.durationMinutes<5||input.durationMinutes>480) throw new Error("مدة الخدمة يجب أن تكون بين 5 و480 دقيقة"); if(!Number.isInteger(input.price)||input.price<0) throw new Error("سعر الخدمة غير صحيح"); const result=await db.insert(services).values({tenantId,name:input.name.trim(),category:input.category.trim()||"عام",durationMinutes:input.durationMinutes,price:input.price,active:1}); const id=Number(result[0].insertId); return (await db.select().from(services).where(and(eq(services.id,id),eq(services.tenantId,tenantId))).limit(1))[0]; }
export async function updateTenantService(tenantId:number,serviceId:number,input:{name?:string;category?:string;durationMinutes?:number;price?:number;active?:boolean}) { const db=await getDb(); if(!db) throw new Error("Database is not available"); if(input.name!==undefined&&!input.name.trim()) throw new Error("اسم الخدمة لا يمكن أن يكون فارغاً"); if(input.durationMinutes!==undefined&&(!Number.isInteger(input.durationMinutes)||input.durationMinutes<5||input.durationMinutes>480)) throw new Error("مدة الخدمة يجب أن تكون بين 5 و480 دقيقة"); if(input.price!==undefined&&(!Number.isInteger(input.price)||input.price<0)) throw new Error("سعر الخدمة غير صحيح"); const existing=(await db.select({id:services.id}).from(services).where(and(eq(services.id,serviceId),eq(services.tenantId,tenantId))).limit(1))[0]; if(!existing) throw new Error("الخدمة غير موجودة في هذه الشركة"); const {active,...fields}=input; await db.update(services).set({...fields,name:fields.name?.trim(),category:fields.category?.trim(),active:active===undefined?undefined:(active?1:0)}).where(and(eq(services.id,serviceId),eq(services.tenantId,tenantId))); return (await db.select().from(services).where(and(eq(services.id,serviceId),eq(services.tenantId,tenantId))).limit(1))[0]; }
export async function listTenantStaff(tenantId:number) { const db=await getDb(); return db ? db.select().from(staff).where(and(eq(staff.tenantId,tenantId),eq(staff.active,1))).orderBy(staff.id) : []; }
export async function addStaff(tenantId:number,input:{name:string;role:string;photoUrl?:string;bio?:string}) { const db=await getDb(); if(!db) throw new Error("Database is not available"); const result=await db.insert(staff).values({tenantId,name:input.name,role:input.role,photoUrl:input.photoUrl||null,bio:input.bio||null}); return (await db.select().from(staff).where(eq(staff.id,Number(result[0].insertId))).limit(1))[0]; }
export async function updateStaff(tenantId:number,staffId:number,input:{name?:string;role?:string;photoUrl?:string|null;bio?:string|null;active?:boolean}) { const db=await getDb(); if(!db) throw new Error("Database is not available"); await db.update(staff).set({...input,active:input.active===undefined?undefined:(input.active?1:0)}).where(and(eq(staff.id,staffId),eq(staff.tenantId,tenantId))); return (await db.select().from(staff).where(eq(staff.id,staffId)).limit(1))[0]; }
export async function listStaffInvites(tenantId:number) { const db=await getDb(); return db ? db.select().from(staffInvites).where(eq(staffInvites.tenantId,tenantId)).orderBy(desc(staffInvites.createdAt)) : []; }
export async function createStaffInvite(tenantId:number,createdByUserId:number,input:{email?:string;staffId?:number;role?:"staff"|"manager"}) { const db=await getDb(); if(!db) throw new Error("Database is not available"); const code=randomBytes(18).toString("hex"); const expiresAt=new Date(Date.now()+7*24*60*60*1000); const result=await db.insert(staffInvites).values({tenantId,createdByUserId,email:input.email||null,staffId:input.staffId||null,role:input.role||"staff",code,expiresAt}); return (await db.select().from(staffInvites).where(eq(staffInvites.id,Number(result[0].insertId))).limit(1))[0]; }
export async function listStaffTimeOff(tenantId:number,staffId:number) { const db=await getDb(); return db ? db.select().from(staffTimeOff).where(and(eq(staffTimeOff.tenantId,tenantId),eq(staffTimeOff.staffId,staffId))).orderBy(staffTimeOff.date) : []; }
export async function addStaffTimeOff(tenantId:number,staffId:number,date:string,reason?:string) { const db=await getDb(); if(!db) throw new Error("Database is not available"); if (!isValidBookingDate(date)) throw new Error("تاريخ الإجازة غير صحيح"); const member=await db.select({id:staff.id}).from(staff).where(and(eq(staff.id,staffId),eq(staff.tenantId,tenantId))).limit(1); if(!member[0]) throw new Error("Сотрудник не найден"); const existing=await db.select({id:staffTimeOff.id}).from(staffTimeOff).where(and(eq(staffTimeOff.tenantId,tenantId),eq(staffTimeOff.staffId,staffId),eq(staffTimeOff.date,date))).limit(1); if(existing[0]) throw new Error("Для этого дня уже указана отгул"); await db.insert(staffTimeOff).values({tenantId,staffId,date,reason:reason?.trim()||null}); return listStaffTimeOff(tenantId,staffId); }
export async function deleteStaffTimeOff(tenantId:number,staffId:number,timeOffId:number) { const db=await getDb(); if(!db) throw new Error("Database is not available"); await db.delete(staffTimeOff).where(and(eq(staffTimeOff.id,timeOffId),eq(staffTimeOff.tenantId,tenantId),eq(staffTimeOff.staffId,staffId))); return listStaffTimeOff(tenantId,staffId); }
export async function listStaffHours(tenantId:number,staffId:number) { const db=await getDb(); return db ? db.select().from(staffWorkingHours).where(and(eq(staffWorkingHours.tenantId,tenantId),eq(staffWorkingHours.staffId,staffId))) : []; }
export async function saveStaffHours(tenantId:number,staffId:number,weekday:number,openMinutes:number,closeMinutes:number,active:boolean) { const db=await getDb(); if(!db) throw new Error("Database is not available"); if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("يوم الأسبوع غير صحيح"); if (!Number.isInteger(openMinutes) || openMinutes < 0 || openMinutes > 1439 || !Number.isInteger(closeMinutes) || closeMinutes < 1 || closeMinutes > 1440 || (active && closeMinutes <= openMinutes)) throw new Error("ساعات العمل غير صحيحة؛ يجب أن يكون وقت الإغلاق بعد الفتح وضمن اليوم"); const member=await db.select({id:staff.id}).from(staff).where(and(eq(staff.id,staffId),eq(staff.tenantId,tenantId))).limit(1); if(!member[0]) throw new Error("Сотрудник не найден"); const existing=await db.select().from(staffWorkingHours).where(and(eq(staffWorkingHours.tenantId,tenantId),eq(staffWorkingHours.staffId,staffId),eq(staffWorkingHours.weekday,weekday))).limit(1); if(existing[0]) await db.update(staffWorkingHours).set({openMinutes,closeMinutes,active:active?1:0}).where(eq(staffWorkingHours.id,existing[0].id)); else await db.insert(staffWorkingHours).values({tenantId,staffId,weekday,openMinutes,closeMinutes,active:active?1:0}); return listStaffHours(tenantId,staffId); }
export { bookings, clients, services, staff, tenants, tenantMembers };
