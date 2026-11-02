import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

const countries = [
  { code:"OM", name:"عُمان", currency:"OMR", timezone:"Asia/Muscat" },
  { code:"AE", name:"الإمارات", currency:"AED", timezone:"Asia/Dubai" },
  { code:"SA", name:"السعودية", currency:"SAR", timezone:"Asia/Riyadh" },
  { code:"QA", name:"قطر", currency:"QAR", timezone:"Asia/Qatar" },
  { code:"KW", name:"الكويت", currency:"KWD", timezone:"Asia/Kuwait" },
  { code:"BH", name:"البحرين", currency:"BHD", timezone:"Asia/Bahrain" },
  { code:"EG", name:"مصر", currency:"EGP", timezone:"Africa/Cairo" },
  { code:"GB", name:"المملكة المتحدة", currency:"GBP", timezone:"Europe/London" },
  { code:"FR", name:"فرنسا", currency:"EUR", timezone:"Europe/Paris" },
  { code:"IT", name:"إيطاليا", currency:"EUR", timezone:"Europe/Rome" },
  { code:"RU", name:"روسيا", currency:"RUB", timezone:"Europe/Moscow" },
  { code:"KZ", name:"كازاخستان", currency:"KZT", timezone:"Asia/Almaty" },
  { code:"US", name:"الولايات المتحدة", currency:"USD", timezone:"America/New_York" },
];
const languages = [{code:"ar",label:"العربية"},{code:"en",label:"English"},{code:"ru",label:"Русский"},{code:"fr",label:"Français"},{code:"it",label:"Italiano"}] as const;

export default function SetupCompany() {
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const me = trpc.auth.me.useQuery();
  const current = trpc.workspace.current.useQuery();
  const [name,setName] = useState("");
  const [slug,setSlug] = useState("");
  const [city,setCity] = useState("");
  const [countryCode,setCountryCode] = useState("OM");
  const [currency,setCurrency] = useState("OMR");
  const [timezone,setTimezone] = useState("Asia/Muscat");
  const [defaultLanguage,setDefaultLanguage] = useState<"ar"|"en"|"ru"|"fr"|"it">(language);
  const [error,setError] = useState("");
  const selectedCountry = useMemo(()=>countries.find(item=>item.code===countryCode) ?? countries[0],[countryCode]);
  const create = trpc.workspace.createTenant.useMutation({
    onSuccess:()=>{ window.location.assign("/"); },
    onError:e=>setError(t(e.message)),
  });
  if (me.isLoading || current.isLoading) return <main className="auth-loading">{t("جارٍ التحقق من الحساب...")}</main>;
  if (!me.data) { navigate("/login"); return null; }
  if (current.data) { navigate("/"); return null; }
  const submit=(event:React.FormEvent)=> {
    event.preventDefault(); setError("");
    const cleanName=name.trim();
    const cleanSlug=(slug.trim() || cleanName).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    if(cleanSlug.length<2){setError(t("اكتب اسماً مناسباً للرابط المختصر باللغة الإنجليزية."));return;}
    create.mutate({name:cleanName,slug:cleanSlug,city:city.trim()||undefined,countryCode,currency,timezone,defaultLanguage});
  };
  return <main className="clientora-auth" dir={language==="ar"?"rtl":"ltr"}>
    <section className="auth-main" style={{width:"100%",maxWidth:720,margin:"0 auto",padding:24}}>
      <div className="auth-card" style={{width:"100%",maxWidth:620,margin:"auto"}}>
        <div className="auth-card-brand"><span>✿</span><b>Clientora</b></div>
        <div className="auth-card-head"><h1>{t("إعداد شركتك")}</h1><p>{t("أكمل بيانات شركتك لإنشاء مساحة العمل وفتح لوحة التحكم.")}</p></div>
        <form onSubmit={submit} className="modal-form">
          <label>{t("اسم الشركة أو الصالون")}<input required minLength={2} maxLength={160} value={name} onChange={e=>{setName(e.target.value);if(!slug)setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""));}} placeholder={t("مثال: Clientora Beauty Lounge")}/></label>
          <label>{t("الرابط المختصر")}<input required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={120} value={slug} onChange={e=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} placeholder="my-salon"/></label>
          <label>{t("المدينة")}<input maxLength={120} value={city} onChange={e=>setCity(e.target.value)} placeholder={t("مثال: مسقط")}/></label>
          <label>{t("الدولة")}<select value={countryCode} onChange={e=>{const item=countries.find(country=>country.code===e.target.value) ?? countries[0];setCountryCode(item.code);setCurrency(item.currency);setTimezone(item.timezone);}}>{countries.map(item=><option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</select></label>
          <label>{t("العملة")}<input dir="ltr" required maxLength={12} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></label>
          <label>{t("المنطقة الزمنية")}<input dir="ltr" required maxLength={64} value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder={selectedCountry.timezone}/></label>
          <label>{t("لغة الشركة الافتراضية")}<select value={defaultLanguage} onChange={e=>setDefaultLanguage(e.target.value as typeof defaultLanguage)}>{languages.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
          {error && <div className="auth-message error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={create.isPending || !name.trim()}>{create.isPending?t("جارٍ إنشاء مساحة العمل..."):t("إنشاء الشركة وفتح لوحة التحكم")}</button>
        </form>
        <p className="form-hint">{t("يمكن تعديل إعدادات البلد والعملة والمنطقة الزمنية لاحقاً من إعدادات الشركة.")}</p>
      </div>
    </section>
  </main>;
}
