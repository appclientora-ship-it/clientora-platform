import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole, Mail, UserRound, Eye, EyeOff, Building2, Users, CalendarDays, ChartNoAxesCombined, Globe2, ShieldCheck, LogIn } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

type Mode = "login" | "register" | "forgot" | "reset";

export default function AuthPage({ mode = "login" }: { mode?: Mode }) {
  const { language, setLanguage, t } = useLanguage();
  const [, navigate] = useLocation();
  const query = new URLSearchParams(useSearch());
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"owner" | "staff">("owner");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState(() => query.get("reset") === "1" ? t("تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.") : "");
  const [error, setError] = useState("");

  const login = trpc.auth.login.useMutation({ onSuccess: () => navigate("/"), onError: e => setError(t(e.message)) });
  const register = trpc.auth.register.useMutation({ onSuccess: () => navigate("/"), onError: e => setError(t(e.message)) });
  const forgot = trpc.auth.forgotPassword.useMutation({ onSuccess: r => setMessage(t(r.message)), onError: e => setError(t(e.message)) });
  const reset = trpc.auth.resetPassword.useMutation({ onSuccess: () => navigate("/login?reset=1"), onError: e => setError(t(e.message)) });
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (mode === "register") register.mutate({ name, email, password, ...(accountType === "staff" ? { inviteCode } : {}) });
    else if (mode === "forgot") forgot.mutate({ email });
    else if (mode === "reset") reset.mutate({ token: query.get("token") || "", password });
    else login.mutate({ email, password });
  };
  const title = t(mode === "register" ? "إنشاء حساب جديد" : mode === "forgot" ? "استعادة كلمة المرور" : mode === "reset" ? "تعيين كلمة مرور جديدة" : "مرحباً بعودتك!");
  const description = mode === "login" ? t("سجل دخولك للوصول إلى حسابك وإدارة أعمالك.") :
    mode === "register" ? (accountType === "staff" ? t("أدخل كود الدعوة الذي أرسله لك صاحب الشركة للانضمام إلى فريقه.") : t("أنشئ حساب صاحب الشركة وابدأ إعداد مساحة عملك.")) :
    mode === "forgot" ? t("سنرسل رابطاً آمناً إلى بريدك الإلكتروني.") : t("اكتب كلمة مرور جديدة لحسابك.");
  const busy = login.isPending || register.isPending || forgot.isPending || reset.isPending;

  return <main className="auth-page clientora-auth" dir={language === "ar" ? "rtl" : "ltr"}>
    <section className="auth-visual">
      <div className="auth-visual-top"><div className="auth-brand"><span className="auth-brand-mark">✿</span><div><b>Clientora</b><small>Book · Manage · Grow</small></div></div></div>
      <div className="auth-visual-content">
        <span className="auth-kicker">{t("منصة واحدة لإدارة أعمالك")}</span>
        <h2>{t("مرحباً بك في")}<strong> Clientora</strong></h2>
        <p>{t("منصة متكاملة لإدارة الصالونات والسبا والحلاقين والحجوزات أونلاين.")}</p>
        <div className="auth-benefits">
          <div><CalendarDays/><span>{t("إدارة المواعيد بسهولة ومرونة")}</span></div>
          <div><Users/><span>{t("متابعة العملاء والموظفين")}</span></div>
          <div><ChartNoAxesCombined/><span>{t("تقارير دقيقة واحترافية")}</span></div>
          <div><Globe2/><span>{t("متعدد اللغات والعملات")}</span></div>
        </div>
      </div>
      <div className="auth-visual-stats"><div><b>01</b><span>{t("إدارة أسهل")}</span></div><div><b>02</b><span>{t("حجوزات منظمة")}</span></div><div><b>03</b><span>{t("نمو مستمر")}</span></div></div>
      <div className="auth-visual-orb auth-visual-orb-one"/><div className="auth-visual-orb auth-visual-orb-two"/>
    </section>
    <section className="auth-main">
      <div className="auth-language"><Globe2 size={18}/>{(["ar","en","ru"] as const).map(code=><button type="button" key={code} className={language===code?"active":""} onClick={()=>setLanguage(code)}>{code==="ar"?"العربية":code==="en"?"English":"Русский"}</button>)}</div>
      <section className="auth-card">
        <div className="auth-card-brand"><span>✿</span><b>Clientora</b></div>
        <div className="auth-card-head"><h1>{title}</h1><p>{description}</p></div>
        {mode === "register" && <div className="auth-account-types" role="group" aria-label={t("نوع الحساب")}>
          <button type="button" className={accountType === "owner" ? "selected" : ""} onClick={() => setAccountType("owner")}><Building2 size={17}/>{t("صاحب الشركة")}</button>
          <button type="button" className={accountType === "staff" ? "selected" : ""} onClick={() => setAccountType("staff")}><UserRound size={17}/>{t("موظف")}</button>
        </div>}
        <form onSubmit={submit}>
          {mode === "register" && <>
            <label className="auth-field"><UserRound size={18}/><input required value={name} onChange={e=>setName(e.target.value)} placeholder={t("الاسم الكامل")}/></label>
            {accountType === "staff" && <label className="auth-field"><LockKeyhole size={18}/><input required value={inviteCode} onChange={e=>setInviteCode(e.target.value.trim())} placeholder={t("كود دعوة الشركة")} dir="ltr"/></label>}
          </>}
          {mode !== "reset" && <label className="auth-field"><Mail size={18}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={t("البريد الإلكتروني")} dir="ltr"/></label>}
          {mode !== "forgot" && <label className="auth-field"><LockKeyhole size={18}/><input required minLength={8} type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={t("كلمة المرور (8 أحرف على الأقل)")} dir="ltr"/><button className="auth-eye" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?t("إخفاء كلمة المرور"):t("إظهار كلمة المرور")}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></label>}
          {mode === "login" && <div className="auth-options"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>{t("تذكرني")}</label><button type="button" onClick={()=>navigate("/forgot-password")}>{t("نسيت كلمة المرور؟")}</button></div>}
          {error && <div className="auth-message error">{error}</div>}
          {message && <div className="auth-message success"><CheckCircle2 size={17}/>{message}</div>}
          <button className="auth-submit" disabled={busy}>{busy?t("جارٍ المعالجة..."):mode==="login"?t("تسجيل الدخول"):mode==="register"?t("إنشاء الحساب"):mode==="forgot"?t("إرسال رابط الاستعادة"):t("حفظ كلمة المرور")}<LogIn size={18}/></button>
        </form>
        <div className="auth-links">
          {mode === "login" && <span>{t("ليس لديك حساب؟")} <button onClick={()=>navigate("/register")}>{t("إنشاء حساب جديد")}</button></span>}
          {mode === "register" && <span>{t("لديك حساب؟")} <button onClick={()=>navigate("/login")}>{t("تسجيل الدخول")}</button></span>}
          {(mode === "forgot" || mode === "reset") && <button onClick={()=>navigate("/login")}><ArrowLeft size={15}/>{t("العودة للدخول")}</button>}
        </div>
        <small className="auth-security"><ShieldCheck size={15}/>{t("بياناتك آمنة ومحمية بأعلى معايير الأمان")}</small>
      </section>
      <footer className="auth-footer"><span>{t("الشروط والأحكام")}</span><span>{t("سياسة الخصوصية")}</span><span>© Clientora</span></footer>
    </section>
  </main>;
}
