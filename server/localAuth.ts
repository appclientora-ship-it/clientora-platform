import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { passwordResets, users, staffInvites, tenantMembers, staff, type User } from "../drizzle/schema";

const SESSION_COOKIE = "clientora_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30;
const secret = () => {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SESSION_SECRET must be configured with at least 32 characters");
  return value;
};
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const passwordHash = async (password: string, salt = crypto.randomBytes(16).toString("hex")) => new Promise<string>((resolve, reject) => crypto.scrypt(password, salt, 64, (error, derived) => error ? reject(error) : resolve(`${salt}:${derived.toString("hex")}`)));
const verifyPassword = async (password: string, stored: string) => {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected || !/^[a-f0-9]{128}$/i.test(expected)) return false;
  const actual = await passwordHash(password, salt);
  const actualBytes = Buffer.from(actual.split(":")[1], "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
};
const sign = (userId: number, expires: number) => { const payload = `${userId}.${expires}`; const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url"); return `${payload}.${signature}`; };
const readSession = (token?: string) => { if (!token) return null; const [id, expires, signature] = token.split("."); const userId = Number(id); if (!userId || !expires || !signature || Number(expires) < Date.now()) return null; const expected = crypto.createHmac("sha256", secret()).update(`${id}.${expires}`).digest("base64url"); const supplied = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  return supplied.length === calculated.length && crypto.timingSafeEqual(supplied, calculated) ? userId : null; };
export const localSessionCookie = SESSION_COOKIE;
export function sessionForUser(userId: number) { return sign(userId, Date.now() + SESSION_TTL); }
export function userIdFromSession(token?: string) { return readSession(token); }
export async function findLocalUserById(id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0]; }
export function assertEmailRegistrationAllowed(existingUser: Pick<User, "passwordHash"> | undefined): void {
  if (existingUser) {
    throw new Error("هذا البريد مسجل بالفعل، استخدم تسجيل الدخول أو استعادة كلمة المرور");
  }
}

export async function registerLocalUser(input: {email:string;password:string;name:string;inviteCode?:string}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = input.email.trim().toLowerCase();
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  assertEmailRegistrationAllowed(existing);
  const hashedPassword = await passwordHash(input.password);
  if (input.inviteCode) {
    const now = new Date();
    return db.transaction(async tx => {
      const invite = (await tx.select().from(staffInvites).where(and(
        eq(staffInvites.code, input.inviteCode!),
        isNull(staffInvites.acceptedAt),
        gt(staffInvites.expiresAt, now),
      )).limit(1))[0];
      if (!invite || !invite.staffId) throw new Error("كود الدعوة غير صالح أو منتهي؛ اطلب دعوة جديدة من صاحب الشركة");
      if (invite.email && invite.email.trim().toLowerCase() !== email) throw new Error("هذا الكود مخصص لبريد إلكتروني آخر");
      const result = await tx.insert(users).values({
        openId: `local:${crypto.randomUUID()}`, email, name: input.name.trim(),
        loginMethod: "password", passwordHash: hashedPassword,
      });
      const userId = Number(result[0].insertId);
      const linkedStaff = await tx.update(staff).set({userId}).where(and(
        eq(staff.id, invite.staffId), eq(staff.tenantId, invite.tenantId), eq(staff.active, 1), isNull(staff.userId),
      ));
      if (Number(linkedStaff[0]?.affectedRows ?? 0) !== 1) throw new Error("ملف الموظف غير متاح أو مرتبط بحساب آخر؛ تواصل مع صاحب الشركة");
      await tx.insert(tenantMembers).values({tenantId:invite.tenantId,userId,role:invite.role});
      const accepted = await tx.update(staffInvites).set({acceptedAt:now}).where(and(
        eq(staffInvites.id,invite.id), isNull(staffInvites.acceptedAt), gt(staffInvites.expiresAt,now),
      ));
      if (Number(accepted[0]?.affectedRows ?? 0) !== 1) throw new Error("تم استخدام كود الدعوة بالفعل؛ اطلب دعوة جديدة");
      return (await tx.select().from(users).where(eq(users.id,userId)).limit(1))[0];
    });
  }
  const result = await db.insert(users).values({
    openId: `local:${crypto.randomUUID()}`, email, name: input.name.trim(),
    loginMethod: "password", passwordHash: hashedPassword,
  });
  return (await db.select().from(users).where(eq(users.id, Number(result[0].insertId))).limit(1))[0];
}
export async function loginLocalUser(emailInput:string,password:string) { const db=await getDb(); if(!db) throw new Error("Database is not available"); const email=emailInput.trim().toLowerCase(); const user=(await db.select().from(users).where(eq(users.email,email)).limit(1))[0]; if(!user?.passwordHash || !(await verifyPassword(password,user.passwordHash))) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة"); await db.update(users).set({lastSignedIn:new Date(),loginMethod:"password"}).where(eq(users.id,user.id)); return (await db.select().from(users).where(eq(users.id,user.id)).limit(1))[0]; }
async function sendResetEmail(email:string, token:string) { const host=process.env.SMTP_HOST; const port=Number(process.env.SMTP_PORT||465); const user=process.env.SMTP_USER; const pass=process.env.SMTP_PASS; const appUrl=(process.env.APP_URL||"https://clientora.app").replace(/\/$/,""); if(!host||!user||!pass){ console.warn("[Password reset] SMTP is not configured; reset email was not sent"); return; } const transporter=nodemailer.createTransport({host,port,secure:port===465,auth:{user,pass}}); await transporter.sendMail({from:process.env.SMTP_FROM||user,to:email,subject:"استعادة كلمة مرور Clientora",text:`لاستعادة كلمة المرور افتح الرابط التالي خلال ساعة:\n\n${appUrl}/reset-password?token=${token}\n\nإذا لم تطلب ذلك تجاهل الرسالة.`}); }
export async function requestPasswordReset(emailInput:string) { const db=await getDb(); if(!db) throw new Error("Database is not available"); const email=emailInput.trim().toLowerCase(); const user=(await db.select().from(users).where(eq(users.email,email)).limit(1))[0]; if(user){ const token=crypto.randomBytes(32).toString("hex"); const now=new Date(); await db.transaction(async tx=>{ await tx.update(passwordResets).set({usedAt:now}).where(and(eq(passwordResets.userId,user.id),isNull(passwordResets.usedAt))); await tx.insert(passwordResets).values({userId:user.id,tokenHash:hash(token),expiresAt:new Date(now.getTime()+60*60*1000)}); }); await sendResetEmail(email,token); } return {message:"إذا كان البريد مسجلاً، ستصلك تعليمات الاستعادة."}; }
export async function resetPassword(token:string,password:string) { const db=await getDb(); if(!db) throw new Error("Database is not available"); const newPasswordHash=await passwordHash(password); const now=new Date(); return db.transaction(async tx=>{ const row=(await tx.select().from(passwordResets).where(and(eq(passwordResets.tokenHash,hash(token)),isNull(passwordResets.usedAt),gt(passwordResets.expiresAt,now))).limit(1))[0]; if(!row) throw new Error("رابط الاستعادة غير صالح أو منتهي"); const claim=await tx.update(passwordResets).set({usedAt:now}).where(and(eq(passwordResets.id,row.id),isNull(passwordResets.usedAt),gt(passwordResets.expiresAt,now))); if(Number(claim[0]?.affectedRows ?? 0)!==1) throw new Error("رابط الاستعادة غير صالح أو منتهي"); await tx.update(passwordResets).set({usedAt:now}).where(and(eq(passwordResets.userId,row.userId),isNull(passwordResets.usedAt))); const updated=await tx.update(users).set({passwordHash:newPasswordHash,loginMethod:"password"}).where(eq(users.id,row.userId)); if(Number(updated[0]?.affectedRows ?? 0)!==1) throw new Error("تعذر تحديث كلمة المرور"); return {success:true}; }); }
