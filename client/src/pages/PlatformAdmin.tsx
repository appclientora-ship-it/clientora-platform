import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { Building2, Search, ShieldCheck, RefreshCw, Ban, CheckCircle2, Clock3, LogOut, ArrowLeft, Globe2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

const palette = {
  ink: "#172b35", muted: "#6b7d86", line: "#e6ecef", surface: "#ffffff",
  canvas: "#f5f8f9", teal: "#0d8f83", tealSoft: "#e5f5f2",
  amber: "#a66a12", amberSoft: "#fff4df", red: "#b54747", redSoft: "#fff0f0",
};
type TenantStatus = "active" | "trial" | "suspended";

export default function PlatformAdminPage() {
  const auth = trpc.auth.me.useQuery();
  const tenants = trpc.platform.tenants.useQuery(undefined, { enabled: auth.data?.role === "admin" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TenantStatus>("all");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const setStatus = trpc.platform.setTenantStatus.useMutation({
    onSuccess: async () => { setPendingId(null); await tenants.refetch(); },
    onError: () => setPendingId(null),
  });

  const rows = tenants.data ?? [];
  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter(x => x.status === "active").length,
    trial: rows.filter(x => x.status === "trial").length,
    suspended: rows.filter(x => x.status === "suspended").length,
  }), [rows]);
  const filtered = useMemo(() => rows.filter(x => {
    const q = search.trim().toLowerCase();
    const matches = !q || [x.name, x.slug, x.city ?? "", x.countryCode ?? ""].some(v => v.toLowerCase().includes(q));
    return matches && (statusFilter === "all" || x.status === statusFilter);
  }), [rows, search, statusFilter]);

  if (auth.isLoading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: palette.muted }}>جارٍ التحقق من صلاحيات مدير المنصة…</div>;
  if (!auth.data) return <Redirect to="/login" />;
  if (auth.data.role !== "admin") return <Redirect to="/" />;

  const statusLabel = (status: TenantStatus) => status === "active" ? "نشط" : status === "trial" ? "تجريبي" : "موقوف";
  const statusColor = (status: TenantStatus) => status === "active" ? { color: palette.teal, background: palette.tealSoft } : status === "trial" ? { color: palette.amber, background: palette.amberSoft } : { color: palette.red, background: palette.redSoft };
  const nextStatus = (status: TenantStatus): TenantStatus => status === "suspended" ? "active" : "suspended";

  return <main dir="rtl" style={{ minHeight: "100vh", background: palette.canvas, color: palette.ink, fontFamily: "inherit", padding: "28px clamp(16px, 4vw, 56px)" }}>
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: palette.teal, color: "white", display: "grid", placeItems: "center" }}><ShieldCheck size={25}/></div>
          <div><div style={{ fontWeight: 800, fontSize: 23 }}>Clientora <span style={{ color: palette.teal }}>Control Center</span></div><div style={{ color: palette.muted, fontSize: 13, marginTop: 4 }}>لوحة الإدارة المركزية للمنصة</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: palette.muted, fontSize: 13 }}>{auth.data.name || auth.data.email || "مدير المنصة"}</span>
          <button onClick={() => tenants.refetch()} disabled={tenants.isFetching} style={buttonStyle}><RefreshCw size={16}/> تحديث البيانات</button>
          <a href="/" style={{ ...buttonStyle, textDecoration: "none" }}><ArrowLeft size={16}/> لوحة الشركة</a>
        </div>
      </header>

      <section style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: "0 0 7px", fontWeight: 800 }}>نظرة عامة على المنصة</h1>
        <p style={{ margin: 0, color: palette.muted }}>متابعة الشركات وحالات حساباتها من مكان واحد، دون الوصول إلى بيانات تشغيلها الداخلية.</p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="إجمالي الشركات" value={counts.all} icon={<Building2 size={20}/>} accent={palette.ink}/>
        <StatCard label="حسابات نشطة" value={counts.active} icon={<CheckCircle2 size={20}/>} accent={palette.teal}/>
        <StatCard label="فترة تجريبية" value={counts.trial} icon={<Clock3 size={20}/>} accent={palette.amber}/>
        <StatCard label="حسابات موقوفة" value={counts.suspended} icon={<Ban size={20}/>} accent={palette.red}/>
      </section>

      <section style={{ background: palette.surface, border: "1px solid " + palette.line, borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 28px rgba(20,45,55,.04)" }}>
        <div style={{ padding: 20, borderBottom: "1px solid " + palette.line, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0, fontSize: 19 }}>إدارة الشركات</h2><p style={{ margin: "5px 0 0", color: palette.muted, fontSize: 13 }}>عرض حالة كل مساحة عمل وإيقافها أو إعادة تفعيلها.</p></div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", right: 12, top: 13, color: palette.muted }}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرابط أو المدينة" style={{ ...inputStyle, paddingRight: 36, width: 260, maxWidth: "70vw" }}/></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={inputStyle}><option value="all">كل الحالات</option><option value="active">نشط</option><option value="trial">تجريبي</option><option value="suspended">موقوف</option></select>
          </div>
        </div>

        {tenants.isLoading ? <div style={{ padding: 36, textAlign: "center", color: palette.muted }}>جارٍ تحميل الشركات…</div> : tenants.isError ? <div style={{ padding: 36, textAlign: "center", color: palette.red }}>تعذر تحميل الشركات. تحقق من اتصالك ثم أعد المحاولة.</div> : filtered.length === 0 ? <div style={{ padding: 36, textAlign: "center", color: palette.muted }}>لا توجد شركات مطابقة للبحث.</div> :
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead><tr style={{ background: "#f9fbfc", color: palette.muted, textAlign: "right", fontSize: 12 }}>
              {["الشركة","الرابط","الموقع","العملة","تاريخ الإنشاء","الحالة","الإجراء"].map(label => <th key={label} style={{ padding: "14px 18px", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</th>)}
            </tr></thead>
            <tbody>{filtered.map(tenant => <tr key={tenant.id} style={{ borderTop: "1px solid " + palette.line }}>
              <td style={cellStyle}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: palette.tealSoft, color: palette.teal, fontWeight: 800 }}>{tenant.name.slice(0,1).toUpperCase()}</div><div><b>{tenant.name}</b><div style={{ color: palette.muted, fontSize: 11 }}>رقم الشركة #{tenant.id}</div></div></div></td>
              <td style={cellStyle}><span dir="ltr">{tenant.slug}</span></td>
              <td style={cellStyle}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Globe2 size={14} color={palette.muted}/>{[tenant.city, tenant.countryCode].filter(Boolean).join("، ") || "—"}</span></td>
              <td style={cellStyle}>{tenant.currency || "—"}</td>
              <td style={cellStyle}>{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString("ar") : "—"}</td>
              <td style={cellStyle}><span style={{ ...statusColor(tenant.status), padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{statusLabel(tenant.status)}</span></td>
              <td style={cellStyle}><button disabled={setStatus.isPending && pendingId === tenant.id} onClick={() => { const target = nextStatus(tenant.status); if (window.confirm(target === "suspended" ? "هل تريد إيقاف هذه الشركة؟ لن يتم حذف بياناتها." : "هل تريد إعادة تفعيل هذه الشركة؟")) { setPendingId(tenant.id); setStatus.mutate({ tenantId: tenant.id, status: target }); } }} style={{ ...buttonStyle, color: tenant.status === "suspended" ? palette.teal : palette.red, borderColor: tenant.status === "suspended" ? "#b9e4dc" : "#f0caca" }}>{setStatus.isPending && pendingId === tenant.id ? "جارٍ الحفظ…" : tenant.status === "suspended" ? "إعادة التفعيل" : "إيقاف الشركة"}</button></td>
            </tr>)}</tbody>
          </table></div>}
        <footer style={{ padding: "13px 20px", borderTop: "1px solid " + palette.line, color: palette.muted, fontSize: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span>عدد النتائج: {filtered.length}</span><span>الإجراءات تسجل في سجل التدقيق على الخادم.</span></footer>
      </section>
      <p style={{ color: palette.muted, fontSize: 12, marginTop: 18 }}>هذه النسخة تعرض بيانات الشركات المتاحة حاليًا فقط. إدارة الاشتراكات والمدفوعات وسجل التدقيق التفصيلي لم تُفعّل بعد.</p>
    </div>
  </main>;
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return <div style={{ background: "#fff", border: "1px solid " + palette.line, borderRadius: 16, padding: 19, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
    <div><div style={{ color: palette.muted, fontSize: 13, marginBottom: 8 }}>{label}</div><div style={{ fontSize: 30, fontWeight: 800, color: palette.ink, lineHeight: 1.1 }}>{value}</div></div>
    <div style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", color: accent, background: accent === palette.teal ? palette.tealSoft : accent === palette.amber ? palette.amberSoft : accent === palette.red ? palette.redSoft : "#edf1f3" }}>{icon}</div>
  </div>;
}
const buttonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, border: "1px solid " + palette.line, background: "#fff", color: palette.ink, borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const inputStyle: React.CSSProperties = { border: "1px solid " + palette.line, background: "#fff", color: palette.ink, borderRadius: 10, padding: "10px 12px", fontSize: 12, outline: "none" };
const cellStyle: React.CSSProperties = { padding: "14px 18px", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
