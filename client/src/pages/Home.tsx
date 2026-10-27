import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

function normalizeBookingSlug(value: string) {
  const raw = value.trim();
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const match = parsed.pathname.match(/\/book\/([^/]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]).toLowerCase();
  } catch { /* treat it as a plain slug below */ }
  return raw.replace(/^.*\/book\//i, "").replace(/^\/+|\/+$/g, "").toLowerCase();
}

function slugFromCompany(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || `company-${Date.now()}`;
}

const statusLabel: Record<string, string> = { pending: "قيد المراجعة", trial: "تجريبية", active: "نشطة", suspended: "موقوفة" };

export default function Home() {
  const me = trpc.auth.me.useQuery();
  const workspaces = trpc.workspace.list.useQuery(undefined, { enabled: !!me.data });
  const tenants = trpc.platform.tenants.useQuery(undefined, { enabled: me.data?.role === "admin" });
  const createTenant = trpc.workspace.create.useMutation({ onSuccess: () => workspaces.refetch() });
  const joinByInvite = trpc.workspace.joinByInvite.useMutation({ onSuccess: () => workspaces.refetch() });
  const setStatus = trpc.platform.setTenantStatus.useMutation({ onSuccess: () => tenants.refetch() });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/"; } });
  const [form, setForm] = useState({ name: "", slug: "", websiteUrl: "", city: "" });
  const [inviteCode, setInviteCode] = useState("");
  const [entryType, setEntryType] = useState<"owner" | "employee">("owner");
  const [subscriptionDays, setSubscriptionDays] = useState(30);
  const [paymentReference, setPaymentReference] = useState("");

  if (me.isLoading) return <div className="center-page">جاري التحقق من الحساب…</div>;
  if (!me.data) return <Landing onLogin={startLogin} />;
  const user = me.data;
  const list = user.role === "admin" ? tenants.data ?? [] : workspaces.data ?? [];
  const primaryWorkspace = user.role === "admin" ? undefined : list[0];
  const workspaceLink = (hash: string) => primaryWorkspace ? `/workspace/${primaryWorkspace.id}${hash}` : "#workspaces";

  return <div className="app-shell" dir="rtl">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">C</span><div><strong>Clientora</strong><small>منصة الحجوزات</small></div></div><nav><a className="active" href="#workspaces">لوحة التحكم</a><a href={workspaceLink("#bookings")}>الجدول والحجوزات</a><a href={workspaceLink("#clients")}>العملاء</a><a href={workspaceLink("#services")}>الخدمات</a><a href={workspaceLink("#staff")}>الموظفون</a><a href="#workspaces">الشركات والمساحات</a><a href={workspaceLink("#notifications")}>الإشعارات</a><a href={workspaceLink("#settings")}>الإعدادات</a></nav><button className="ghost-button" onClick={() => me.refetch()}>تحديث البيانات</button><button className="logout-button" disabled={logout.isPending} onClick={() => logout.mutate()}>{logout.isPending ? "جاري الخروج…" : "تسجيل الخروج"}</button></aside>
    <main className="main-content"><header className="topbar"><div><span className="eyebrow">مساحة الإدارة</span><h1>{user.role === "admin" ? "إدارة Clientora" : "مساحات عملي"}</h1></div><div className="user-chip"><span>{(me.data.name ?? "مستخدم").slice(0, 1)}</span>{me.data.name ?? me.data.email}</div></header>
      <section className="hero-panel"><div><span className="eyebrow">تشغيل حقيقي، بدون بيانات تجريبية</span><h2>إدارة الحجوزات من مكان واحد</h2><p>أنشئ مساحة لشركتك، أضف خدماتك وموظفيك، وشارك رابط الحجز العام مع العملاء.</p></div><div className="hero-stat"><strong>{list.length}</strong><span>{user.role === "admin" ? "شركة في المنصة" : "مساحة متاحة"}</span></div></section>
      {user.role !== "admin" && <><div className="entry-choice"><button type="button" className={entryType === "owner" ? "choice-card selected" : "choice-card"} onClick={() => setEntryType("owner")}><strong>أنا صاحب مشروع</strong><span>إنشاء شركة أو صالون ومساحة حجز</span></button><button type="button" className={entryType === "employee" ? "choice-card selected" : "choice-card"} onClick={() => setEntryType("employee")}><strong>أنا موظف</strong><span>الانضمام بدعوة من صاحب العمل فقط</span></button></div>{entryType === "owner" && <section className="card create-card"><div className="section-heading"><div><h3>تسجيل شركة أو صالون جديد</h3><p>أنت الآن داخل حسابك كصاحب صالون. أدخل بيانات نشاطك، وسيتم إرسال طلبك للمراجعة. بعد تحويل الاشتراك وقبول الأدمن سيُفعّل رابط الحجز الخاص بك.</p></div></div><form className="form-grid" onSubmit={e => { e.preventDefault(); const entered = normalizeBookingSlug(form.slug); const externalFromSlug = /^https?:\/\//i.test(form.slug) && !/\/book\//i.test(form.slug) ? form.slug.trim() : ""; const slug = entered.includes(".") || entered.includes("/") || entered.startsWith("http") ? slugFromCompany(form.name) : entered || slugFromCompany(form.name); createTenant.mutate({ ...form, slug, websiteUrl: form.websiteUrl || externalFromSlug }); }}><label>اسم الشركة أو الصالون<input required minLength={2} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: ROYAL RELAX" /></label><label>موقع الشركة الخارجي (اختياري)<input type="url" value={form.websiteUrl} onChange={e => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://example.com/" dir="ltr" /></label><label>رابط الحجز داخل Clientora (اختياري)<input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="اتركه فارغًا ليصبح royal-relax" dir="ltr" /></label><label>المدينة<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="مسقط" /></label><button className="primary-button" disabled={createTenant.isPending}>{createTenant.isPending ? "جاري التسجيل…" : "إرسال طلب الاشتراك"}</button></form>{createTenant.error && <p className="error-text">{createTenant.error.message}</p>}</section>}{entryType === "employee" && <section className="card invite-join-card"><div className="section-heading"><div><h3>انضم إلى مكان عمل</h3><p>إذا أرسل لك صاحب الشركة رمز دعوة، اكتبه هنا لتظهر الشركة فورًا في مساحاتك.</p></div></div><form className="inline-form" onSubmit={e => { e.preventDefault(); joinByInvite.mutate({ code: inviteCode }); }}><input required value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="CL-ABC123" dir="ltr" /><button className="primary-button" disabled={joinByInvite.isPending}>{joinByInvite.isPending ? "جاري الانضمام…" : "انضمام"}</button></form>{joinByInvite.error && <p className="error-text">{joinByInvite.error.message}</p>}{joinByInvite.data && <p className="success-box">تم الانضمام إلى {joinByInvite.data.name}. افتح المساحة من القائمة.</p>}</section>}</>}
      <section id="workspaces" className="card">
        <div className="section-heading"><div><h3>{user.role === "admin" ? "الشركات المسجلة" : "مساحاتك"}</h3><p>كل البيانات المعروضة هنا تأتي من قاعدة البيانات، ولا توجد سجلات وهمية.</p></div><span className="live-pill">● متصل</span></div>
        <div className="tenant-list">{list.length === 0 ? <div className="empty-state">لا توجد شركة بعد. أنشئ أول مساحة من النموذج أعلاه.</div> : list.map(tenant => <article className="tenant-row" key={tenant.id}>
          <div className="tenant-avatar">{tenant.name.slice(0, 1)}</div><div className="tenant-info"><strong>{tenant.name}</strong><span>{tenant.city || "لم تُحدد المدينة"} · رابط الحجز: /book/{tenant.slug}</span>{tenant.websiteUrl && <a href={tenant.websiteUrl} target="_blank" rel="noreferrer">الموقع الخارجي ↗</a>}</div>
          <span className={`status status-${tenant.status}`}>{statusLabel[tenant.status]}</span>
          {user.role === "admin" && <div className="subscription-actions">{tenant.status === "pending" && <><select value={subscriptionDays} onChange={e => setSubscriptionDays(Number(e.target.value))}><option value={30}>سماح 30 يومًا</option><option value={90}>سماح 90 يومًا</option><option value={180}>سماح 180 يومًا</option></select><button className="primary-button" onClick={() => setStatus.mutate({ tenantId: tenant.id, status: "trial", subscriptionDays })}>قبول ومنح فترة السماح</button></>}{tenant.status === "trial" && <><select value={subscriptionDays} onChange={e => setSubscriptionDays(Number(e.target.value))}><option value={30}>اشتراك 30 يومًا</option><option value={90}>اشتراك 90 يومًا</option><option value={180}>اشتراك 180 يومًا</option><option value={365}>اشتراك سنة</option></select><input className="admin-payment-ref" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="مرجع التحويل" /><button className="primary-button" onClick={() => setStatus.mutate({ tenantId: tenant.id, status: "active", subscriptionDays, paymentReference: paymentReference || undefined })}>تم الدفع — تفعيل الاشتراك</button></>}{tenant.status === "active" && <button className="outline-button" onClick={() => setStatus.mutate({ tenantId: tenant.id, status: "suspended" })}>إيقاف الاشتراك</button>}</div>}
          <a className="outline-button" href={`/workspace/${tenant.id}`}>فتح مساحة التشغيل</a><a className="outline-button" href={`/book/${tenant.slug}`}>رابط العميل</a>
        </article>)}</div>
      </section>
    </main>
  </div>;
}

function Landing({ onLogin }: { onLogin: () => void }) { return <div className="landing" dir="rtl"><div className="landing-nav"><div className="brand"><span className="brand-mark">C</span><strong>Clientora</strong></div><button className="outline-button" onClick={onLogin}>تسجيل صاحب صالون / دخول</button></div><div className="landing-grid"><div><span className="eyebrow">منصة تشغيل الحجوزات</span><h1>سجّل نشاطك وابدأ استقبال الحجوزات.</h1><p>أنشئ حسابك، أضف الصالون والخدمات والموظفين، واحصل على رابط حجز خاص بك. أول تسجيل دخول ينشئ حسابك تلقائيًا.</p><button className="primary-button" onClick={onLogin}>تسجيل صاحب شركة أو صالون</button><div className="contact-links"><a href="tel:+96896119298">+968 9611 9298</a><a href="mailto:Appclientora@gmail.com">Appclientora@gmail.com</a><a href="https://www.instagram.com/clientora.app/" target="_blank" rel="noreferrer">Instagram @clientora.app</a></div></div><div className="mock-window"><div className="mock-top"><span></span><span></span><span></span></div><div className="mock-content"><div className="mock-title">لوحة الحجوزات <small>اليوم</small></div><div className="mock-line"></div><div className="mock-line short"></div><div className="mock-cards"><i></i><i></i><i></i></div></div></div></div></div>; }
