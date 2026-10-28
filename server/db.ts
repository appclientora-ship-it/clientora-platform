import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, User, auditLogs, bookingItems, bookings, clients, expenses, services, staff, tenants, tenantMembers, users } from "../drizzle/schema";
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
  const existing = await db.select().from(tenants).where(eq(tenants.slug, input.slug)).limit(1);
  if (existing[0]) throw new Error("رابط الشركة مستخدم بالفعل، اختر اسماً آخر");
  const tenantResult = await db.insert(tenants).values({name:input.name, slug:input.slug, city:input.city ?? null, currency:input.currency ?? "ر.ع", status:"trial"});
  const tenantId = Number(tenantResult[0].insertId);
  await db.insert(tenantMembers).values({tenantId, userId, role:"owner"});
  return (await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1))[0];
}
export async function listBookings(tenantId: number, date: string) {
  const db = await getDb();
  return db ? db.select().from(bookings).where(and(eq(bookings.tenantId, tenantId), eq(bookings.date, date))).orderBy(bookings.startMinutes) : [];
}
export async function listDetailedBookings(tenantId:number,date:string) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({booking:bookings, client:clients, service:services, staff}).from(bookings)
    .innerJoin(clients, eq(bookings.clientId, clients.id)).innerJoin(services, eq(bookings.serviceId, services.id)).innerJoin(staff, eq(bookings.staffId, staff.id))
    .where(and(eq(bookings.tenantId,tenantId),eq(bookings.date,date))).orderBy(bookings.startMinutes);
  return rows.map(row => ({...row.booking, clientName:row.client.name, clientPhone:row.client.phone ?? "", serviceName:row.service.name, durationMinutes:row.booking.durationMinutes || row.service.durationMinutes, price:row.booking.totalPrice || row.service.price, staffName:row.staff.name}));
}
export async function updateBookingForTenant(tenantId:number, bookingId:number, patch:{status?:"new"|"confirmed"|"arrived"|"cancelled"|"no_show";paid?:boolean;note?:string;durationMinutes?:number;staffId?:number;startMinutes?:number;date?:string}, actorUserId:number) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(bookings).where(and(eq(bookings.id,bookingId),eq(bookings.tenantId,tenantId))).limit(1); const booking = rows[0];
  if (!booking) throw new Error("الحجز غير موجود");
  if (patch.status === "cancelled" && booking.paid) throw new Error("لا يمكن إلغاء حجز مدفوع قبل معالجة الاسترجاع المالي");
  const set: Partial<typeof bookings.$inferInsert> = {};
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.paid !== undefined) set.paid = patch.paid ? 1 : 0;
  if (patch.note !== undefined) set.note = patch.note;
  if (patch.durationMinutes !== undefined) set.durationMinutes = Math.max(15, Math.min(480, patch.durationMinutes));
  if (patch.staffId !== undefined) set.staffId = patch.staffId;
  if (patch.startMinutes !== undefined) set.startMinutes = Math.max(0, Math.min(1439, patch.startMinutes));
  if (patch.date !== undefined) set.date = patch.date;
  await db.update(bookings).set(set).where(eq(bookings.id,bookingId));
  await db.insert(auditLogs).values({tenantId,actorUserId,action:patch.status === "cancelled" ? "booking.cancelled" : patch.paid ? "booking.paid" : "booking.updated",entity:"booking",entityId:bookingId});
  return (await db.select().from(bookings).where(eq(bookings.id,bookingId)).limit(1))[0];
}
export async function listNotifications(tenantId:number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(auditLogs).where(eq(auditLogs.tenantId,tenantId)).orderBy(desc(auditLogs.createdAt)).limit(20);
}
export async function getEmployeeReports(tenantId:number,fromDate:string,toDate:string) {
  const db = await getDb(); if (!db) return {employees:[],totals:{bookings:0,completed:0,cancelled:0,revenue:0,paidRevenue:0}};
  const staffRows = await db.select().from(staff).where(eq(staff.tenantId,tenantId));
  const rows = await db.select({booking:bookings,service:services}).from(bookings).innerJoin(services,eq(bookings.serviceId,services.id)).where(and(eq(bookings.tenantId,tenantId),gte(bookings.date,fromDate),lte(bookings.date,toDate)));
  const employees = staffRows.map(person => { const mine=rows.filter(row=>row.booking.staffId===person.id); const active=mine.filter(row=>row.booking.status!=="cancelled"); return {id:person.id,name:person.name,role:person.role,bookings:mine.length,completed:mine.filter(row=>row.booking.status==="arrived").length,cancelled:mine.filter(row=>row.booking.status==="cancelled").length,noShow:mine.filter(row=>row.booking.status==="no_show").length,revenue:active.reduce((sum,row)=>sum+row.service.price,0),paidRevenue:active.filter(row=>row.booking.paid).reduce((sum,row)=>sum+row.service.price,0)}; });
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
export async function getPublicBookingCatalog(slug: string) {
  const db = await getDb(); if (!db) return undefined;
  const tenantRows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  const tenant = tenantRows[0]; if (!tenant || tenant.status === "suspended") return undefined;
  const [serviceRows, staffRows] = await Promise.all([
    db.select().from(services).where(and(eq(services.tenantId, tenant.id), eq(services.active, 1))),
    db.select().from(staff).where(and(eq(staff.tenantId, tenant.id), eq(staff.active, 1))),
  ]);
  return { tenant, services: serviceRows, staff: staffRows };
}
export async function createPublicBooking(input: {slug:string; clientName:string; phone:string; serviceId:number; serviceIds?:number[]; staffId:number; date:string; startMinutes:number; note?:string}) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const tenantRows = await db.select().from(tenants).where(eq(tenants.slug, input.slug)).limit(1);
  const tenant = tenantRows[0]; if (!tenant) throw new Error("Company not found");
  const ids = Array.from(new Set(input.serviceIds?.length ? input.serviceIds : [input.serviceId]));
  const serviceRows = await db.select().from(services).where(and(eq(services.tenantId, tenant.id), eq(services.active, 1)));
  const selectedServices = ids.map(id => serviceRows.find(item => item.id === id)).filter(Boolean) as typeof serviceRows;
  if (selectedServices.length !== ids.length) throw new Error("Service not found");
  const totalDuration = selectedServices.reduce((sum,item)=>sum+item.durationMinutes,0); const totalPrice = selectedServices.reduce((sum,item)=>sum+item.price,0);
  const staffRows = await db.select().from(staff).where(and(eq(staff.id, input.staffId), eq(staff.tenantId, tenant.id), eq(staff.active, 1))).limit(1);
  if (!staffRows[0]) throw new Error("Staff not found");
  const existing = await db.select().from(bookings).where(and(eq(bookings.tenantId, tenant.id), eq(bookings.staffId, input.staffId), eq(bookings.date, input.date)));
  const overlaps = existing.some(item => item.status !== "cancelled" && item.startMinutes < input.startMinutes + totalDuration && input.startMinutes < item.startMinutes + totalDuration);
  if (overlaps) throw new Error("هذا الوقت محجوز بالفعل، اختر وقتاً آخر");
  const clientRows = await db.select().from(clients).where(and(eq(clients.tenantId, tenant.id), eq(clients.phone, input.phone))).limit(1);
  let clientId = clientRows[0]?.id;
  if (!clientId) {
    const result = await db.insert(clients).values({tenantId:tenant.id, name:input.clientName, phone:input.phone, visits:0, totalSpent:0, lastVisit:input.date});
    clientId = Number(result[0].insertId);
  }
  const result = await db.insert(bookings).values({tenantId:tenant.id, clientId, staffId:input.staffId, serviceId:input.serviceId, date:input.date, startMinutes:input.startMinutes, durationMinutes:totalDuration, totalPrice, status:"new", source:"online", paid:0, note:input.note ?? null});
  const bookingId = Number(result[0].insertId);
  await db.insert(bookingItems).values(selectedServices.map(item => ({tenantId:tenant.id,bookingId,serviceId:item.id,staffId:input.staffId,durationMinutes:item.durationMinutes,price:item.price})));
  await db.insert(auditLogs).values({tenantId:tenant.id,actorUserId:null,action:"booking.created",entity:"booking",entityId:bookingId});
  return { id: bookingId, tenantName: tenant.name, serviceName: selectedServices.map(item=>item.name).join(" + "), totalDuration, totalPrice };
}
export { bookings, clients, services, staff, tenants, tenantMembers };
