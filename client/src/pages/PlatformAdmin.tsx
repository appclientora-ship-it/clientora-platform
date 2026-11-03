import { LogOut, RefreshCw, ShieldCheck, Store } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

type Language = "ar" | "en" | "ru";

const copy = {
  ar: {
    title: "إدارة المنصة", subtitle: "نظرة عامة على الشركات المسجلة في Clientora",
    readOnly: "وضع عرض فقط", companies: "الشركات", refresh: "تحديث القائمة",
    name: "الشركة", city: "المدينة", status: "الحالة", created: "تاريخ التسجيل",
    active: "نشطة", trial: "تجريبية", suspended: "موقوفة", empty: "لا توجد شركات مسجلة حتى الآن.",
    loading: "جارٍ تحميل الشركات...", error: "تعذر تحميل قائمة الشركات. حاول مرة أخرى.",
    logout: "تسجيل الخروج", id: "رقم الشركة",
  },
  en: {
    title: "Platform administration", subtitle: "Overview of companies registered on Clientora",
    readOnly: "Read-only access", companies: "Companies", refresh: "Refresh list",
    name: "Company", city: "City", status: "Status", created: "Created",
    active: "Active", trial: "Trial", suspended: "Suspended", empty: "No companies have been registered yet.",
    loading: "Loading companies...", error: "Could not load companies. Please try again.",
    logout: "Sign out", id: "Company ID",
  },
  ru: {
    title: "Управление платформой", subtitle: "Обзор компаний, зарегистрированных в Clientora",
    readOnly: "Только просмотр", companies: "Компании", refresh: "Обновить список",
    name: "Компания", city: "Город", status: "Статус", created: "Дата регистрации",
    active: "Активна", trial: "Пробная", suspended: "Приостановлена", empty: "Пока нет зарегистрированных компаний.",
    loading: "Загрузка компаний...", error: "Не удалось загрузить компании. Попробуйте ещё раз.",
    logout: "Выйти", id: "ID компании",
  },
} satisfies Record<Language, Record<string, string>>;

function statusLabel(status: string, labels: Record<string, string>) {
  return labels[status] ?? status;
}

export default function PlatformAdmin() {
  const { language } = useLanguage();
  const t = copy[language as Language] ?? copy.en;
  const tenants = trpc.platform.tenants.useQuery(undefined, { retry: 1 });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => window.location.assign("/login") });

  const formatDate = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(language === "ar" ? "ar-OM" : language === "ru" ? "ru-RU" : "en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    }).format(date);
  };

  const statusLabels = { active: t.active, trial: t.trial, suspended: t.suspended };
  const rows = tenants.data ?? [];

  return (
    <main dir={language === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#f3f7f6", color: "#142622", padding: "clamp(18px, 4vw, 42px)", fontFamily: "Cairo, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: "#0d8f83", color: "white", display: "grid", placeItems: "center" }}><ShieldCheck size={24} /></div>
            <div><div style={{ fontSize: 21, fontWeight: 800 }}>Clientora</div><div style={{ color: "#6c817a", fontSize: 12 }}>{t.title}</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ border: "1px solid #b8ddd4", background: "#e6f5f1", color: "#087568", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700 }}>{t.readOnly}</span>
            <button onClick={() => logout.mutate()} disabled={logout.isPending} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #dce8e4", background: "white", borderRadius: 10, padding: "9px 13px", cursor: "pointer", color: "#40564f" }}><LogOut size={16} />{t.logout}</button>
          </div>
        </header>

        <section style={{ marginBottom: 22 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800 }}>{t.title}</h1>
          <p style={{ margin: 0, color: "#6c817a" }}>{t.subtitle}</p>
        </section>

        <section style={{ background: "white", border: "1px solid #dce8e4", borderRadius: 18, overflow: "hidden", boxShadow: "0 12px 36px rgba(22,53,45,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 20, borderBottom: "1px solid #e7efec" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}><Store size={19} color="#0d8f83" />{t.companies}<span style={{ background: "#eef7f5", color: "#087568", borderRadius: 20, padding: "2px 9px", fontSize: 12 }}>{rows.length}</span></div>
            <button onClick={() => tenants.refetch()} disabled={tenants.isFetching} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #dce8e4", background: "white", borderRadius: 9, padding: "8px 11px", cursor: "pointer", color: "#40564f" }}><RefreshCw size={15} />{t.refresh}</button>
          </div>

          {tenants.isLoading ? <p role="status" style={{ padding: 28, textAlign: "center", color: "#6c817a" }}>{t.loading}</p>
            : tenants.isError ? <div style={{ padding: 28, textAlign: "center" }}><p style={{ color: "#a33b36" }}>{t.error}</p><button onClick={() => tenants.refetch()}>{t.refresh}</button></div>
            : rows.length === 0 ? <p style={{ padding: 32, textAlign: "center", color: "#6c817a" }}>{t.empty}</p>
            : <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650, textAlign: language === "ar" ? "right" : "left" }}>
                <thead><tr style={{ background: "#f7fbfa", color: "#6c817a", fontSize: 12 }}>
                  {[t.id, t.name, t.city, t.status, t.created].map(label => <th key={label} style={{ padding: "13px 18px", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</th>)}
                </tr></thead>
                <tbody>{rows.map(tenant => <tr key={tenant.id} style={{ borderTop: "1px solid #edf2f0" }}>
                  <td style={{ padding: "15px 18px", color: "#6c817a", fontVariantNumeric: "tabular-nums" }}>#{tenant.id}</td>
                  <td style={{ padding: "15px 18px", fontWeight: 700 }}>{tenant.name}<div style={{ color: "#8a9b95", fontSize: 11, fontWeight: 400, direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}>{tenant.slug}</div></td>
                  <td style={{ padding: "15px 18px", color: "#526760" }}>{tenant.city || "—"}</td>
                  <td style={{ padding: "15px 18px" }}><span style={{ display: "inline-block", borderRadius: 20, padding: "4px 10px", background: tenant.status === "active" ? "#e8f6ee" : tenant.status === "suspended" ? "#fff0ef" : "#fff6e5", color: tenant.status === "active" ? "#217447" : tenant.status === "suspended" ? "#a33b36" : "#94620c", fontSize: 12, fontWeight: 700 }}>{statusLabel(tenant.status, statusLabels)}</span></td>
                  <td style={{ padding: "15px 18px", color: "#6c817a", whiteSpace: "nowrap" }}>{formatDate(tenant.createdAt)}</td>
                </tr>)}</tbody>
              </table>
            </div>}
        </section>
        <p style={{ marginTop: 14, color: "#82938d", fontSize: 11 }}>{t.readOnly}</p>
      </div>
    </main>
  );
}
