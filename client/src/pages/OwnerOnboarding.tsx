import { useState } from "react";
import type { CSSProperties } from "react";
import { Redirect, useLocation } from "wouter";
import { Building2, Check, Globe2, LoaderCircle, MapPin, Sparkles, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

const countries = [
  { code: "OM", name: "سلطنة عُمان", currency: "OMR", timezone: "Asia/Muscat" },
  { code: "AE", name: "الإمارات", currency: "AED", timezone: "Asia/Dubai" },
  { code: "SA", name: "السعودية", currency: "SAR", timezone: "Asia/Riyadh" },
  { code: "QA", name: "قطر", currency: "QAR", timezone: "Asia/Qatar" },
  { code: "KW", name: "الكويت", currency: "KWD", timezone: "Asia/Kuwait" },
  { code: "BH", name: "البحرين", currency: "BHD", timezone: "Asia/Bahrain" },
  { code: "EG", name: "مصر", currency: "EGP", timezone: "Africa/Cairo" },
  { code: "GB", name: "المملكة المتحدة", currency: "GBP", timezone: "Europe/London" },
  { code: "US", name: "الولايات المتحدة", currency: "USD", timezone: "America/New_York" },
];
const money = (cents: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);

export default function OwnerOnboarding() {
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const auth = trpc.auth.me.useQuery();
  const memberships = trpc.workspace.memberships.useQuery();
  const plans = trpc.workspace.onboardingPlans.useQuery();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("OM");
  const [planKey, setPlanKey] = useState("");
  const country = countries.find(item => item.code === countryCode) ?? countries[0];
  const create = trpc.workspace.finishOwnerOnboarding.useMutation({
    onSuccess: () => { memberships.refetch(); navigate("/"); },
  });
  const selectedPlan = plans.data?.find(plan => plan.planKey === planKey);
  const slugFromName = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110);
  const canSubmit = name.trim().length >= 2 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !!selectedPlan && !create.isPending;
  if (auth.isLoading || memberships.isLoading) return <div className="auth-loading">{t("جارٍ تحميل إعداد مساحة العمل...")}</div>;
  if (!auth.data) return <Redirect to="/login" />;
  if (auth.data.role === "admin") return <Redirect to="/" />;
  if ((memberships.data?.length ?? 0) > 0) return <Redirect to="/" />;

  return <main dir={language === "ar" ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f5faf9,#f7f7fb)", padding: "32px 16px", color: "#172b2a" }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}><span style={{ width: 46, height: 46, borderRadius: 15, background: "#0d8f83", color: "white", display: "grid", placeItems: "center" }}><Sparkles/></span><div><b style={{ fontSize: 22 }}>Clientora</b><div style={{ color: "#647875", fontSize: 13 }}>{t("إعداد مساحة عملك")}</div></div></header>
      <section style={{ background: "white", border: "1px solid #e4ecea", borderRadius: 24, padding: "clamp(20px,4vw,36px)", boxShadow: "0 18px 50px #173b3510" }}>
        <div style={{ marginBottom: 26 }}><div style={{ color: "#0d8f83", fontWeight: 700, fontSize: 13 }}>{t("الخطوة الأخيرة قبل البدء")}</div><h1 style={{ fontSize: 30, margin: "8px 0" }}>{t("أنشئ مساحة صالونك")}</h1><p style={{ color: "#687b78", margin: 0 }}>{t("أدخل بيانات نشاطك واختر الباقة المناسبة لفريقك.")}</p></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16 }}>
          <label style={field}><span><Building2 size={16}/> {t("اسم الصالون أو الشركة")}</span><input style={input} value={name} onChange={e => { setName(e.target.value); if (!slug || slug === slugFromName(name)) setSlug(slugFromName(e.target.value)); }} placeholder={t("مثال: Glow Beauty Salon")} /></label>
          <label style={field}><span>clientora.app/{t("رابط الصالون")}</span><input style={input} dir="ltr" value={slug} onChange={e => setSlug(slugFromName(e.target.value))} placeholder="glow-beauty" /></label>
          <label style={field}><span><MapPin size={16}/> {t("المدينة")}</span><input style={input} value={city} onChange={e => setCity(e.target.value)} placeholder={t("مثال: مسقط")} /></label>
          <label style={field}><span><Globe2 size={16}/> {t("الدولة")}</span><select style={input} value={countryCode} onChange={e => setCountryCode(e.target.value)}>{countries.map(item => <option key={item.code} value={item.code}>{item.name} · {item.currency}</option>)}</select></label>
        </div>
        <div style={{ marginTop: 28 }}><h2 style={{ fontSize: 21, marginBottom: 6 }}>{t("اختر باقتك")}</h2><p style={{ color: "#687b78", marginTop: 0, fontSize: 14 }}>{t("يمكنك تغيير الباقة لاحقاً من إعدادات الاشتراك.")}</p>
          {plans.isLoading ? <p>{t("جارٍ تحميل الباقات...")}</p> : plans.isError ? <p style={{ color: "#b42318" }}>{t("تعذر تحميل الباقات. أعد تحميل الصفحة.")}</p> : !plans.data?.length ? <p style={{ color: "#b42318" }}>{t("لا توجد باقات مفعلة حالياً. يرجى التواصل مع إدارة Clientora.")}</p> :
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>{plans.data.map(plan => <button type="button" key={plan.planKey} onClick={() => setPlanKey(plan.planKey)} style={{ textAlign: "start", border: planKey === plan.planKey ? "2px solid #0d8f83" : "1px solid #dce7e4", background: planKey === plan.planKey ? "#f0faf8" : "white", borderRadius: 16, padding: 16, cursor: "pointer", color: "#173b35" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>{plan.planKey}</b>{planKey === plan.planKey && <Check size={18} color="#0d8f83"/>}</div><div style={{ fontSize: 24, fontWeight: 800, margin: "12px 0 4px" }}>{money(plan.monthlyPriceCents, plan.currency)}</div><div style={{ color: "#687b78", fontSize: 13 }}>{t("شهرياً")} · {plan.staffLimit} {t("موظفين")}</div></button>)}</div>}
        </div>
        {create.error && <p role="alert" style={{ color: "#b42318", marginTop: 18 }}>{t(create.error.message)}</p>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 28, paddingTop: 22, borderTop: "1px solid #edf1f0" }}><div style={{ color: "#687b78", fontSize: 13, maxWidth: 470 }}><Users size={15} style={{ verticalAlign: "middle", marginInlineEnd: 6 }}/>{t("سيتم إنشاء مساحة العمل وربط الباقة في خطوة واحدة. اختيار الباقة لا يسحب أي مبلغ؛ الدفع الإلكتروني سيُفعّل عند ربط بوابة الدفع.")}</div><button disabled={!canSubmit} onClick={() => create.mutate({ name, slug, city: city || undefined, countryCode, currency: country.currency, timezone: country.timezone, planKey })} style={{ border: 0, borderRadius: 13, padding: "14px 24px", background: canSubmit ? "#0d8f83" : "#a9c3be", color: "white", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 9 }}>{create.isPending && <LoaderCircle size={17} className="animate-spin" />}{t("إنشاء مساحة العمل والبدء")}</button></div>
      </section>
    </div>
  </main>;
}
const field: CSSProperties = { display: "grid", gap: 8, fontWeight: 650, fontSize: 14 };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #d9e4e1", borderRadius: 11, padding: "12px 13px", background: "white", color: "#173b35", outlineColor: "#0d8f83", font: "inherit" };
