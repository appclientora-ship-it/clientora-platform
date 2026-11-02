import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

type Mode = "login" | "register" | "forgot" | "reset";

export default function AuthPage({ mode = "login" }: { mode?: Mode }) {
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const query = new URLSearchParams(useSearch());
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"owner" | "staff">("owner");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(() => query.get("reset") === "1" ? t("تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.") : "");
  const [error, setError] = useState("");

  const login = trpc.auth.login.useMutation({ onSuccess: () => navigate("/"), onError: e => setError(t(e.message)) });
  const register = trpc.auth.register.useMutation({ onSuccess: () => navigate("/"), onError: e => setError(e.message) });
  const forgot = trpc.auth.forgotPassword.useMutation({ onSuccess: r => setMessage(r.message), onError: e => setError(e.message) });
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => navigate("/login?reset=1"),
    onError: e => setError(t(e.message)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (mode === "register") register.mutate({ name, email, password, ...(accountType === "staff" ? { inviteCode } : {}) });
    else if (mode === "forgot") forgot.mutate({ email });
    else if (mode === "reset") reset.mutate({ token: query.get("token") || "", password });
    else login.mutate({ email, password });
  };
  const title = t(mode === "register" ? "إنشاء حساب جديد" : mode === "forgot" ? "استعادة كلمة المرور" : mode === "reset" ? "تعيين كلمة مرور جديدة" : "تسجيل الدخول إلى Clientora");
  const description = mode === "login" ? t("ادخل إلى لوحة الحجوزات الخاصة بك.") :
    mode === "register" ? (accountType === "staff" ? t("أدخل كود الدعوة الذي أرسله لك صاحب الشركة للانضمام إلى فريقه.") : t("أنشئ حساب صاحب الشركة وابدأ إعداد مساحة عملك.")) :
    mode === "forgot" ? t("سنرسل رابطاً آمناً إلى بريدك الإلكتروني.") : t("اكتب كلمة مرور جديدة لحسابك.");
  const busy = login.isPending || register.isPending || forgot.isPending || reset.isPending;

  return <main className="auth-page" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="auth-decoration">
      <div className="auth-orb orb-one" /><div className="auth-orb orb-two" />
      <div className="auth-brand"><span>✦</span><b>Clientora</b><small>{t("منصة إدارة الحجوزات")}</small></div>
      <div className="auth-quote">{t("نظّم مواعيدك،")}<br /><strong>{t("ودَع فريقك يعمل براحة.")}</strong></div>
    </div>
    <section className="auth-card">
      <div className="auth-card-head">
        <div className="auth-logo">✦</div><span className="auth-eyebrow">{t("مساحة تشغيل آمنة")}</span>
        <h1>{title}</h1><p>{description}</p>
      </div>
      <form onSubmit={submit}>
        {mode === "register" && <>
          <label className="auth-field"><UserRound size={17} /><input required value={name} onChange={e => setName(e.target.value)} placeholder={t("الاسم الكامل")} /></label>
          <div className="auth-account-types" role="group" aria-label={t("نوع الحساب")}>
            <button type="button" className={accountType === "owner" ? "selected" : ""} onClick={() => setAccountType("owner")}>{t("صاحب شركة")}</button>
            <button type="button" className={accountType === "staff" ? "selected" : ""} onClick={() => setAccountType("staff")}>{t("موظف")}</button>
          </div>
          {accountType === "staff" && <label className="auth-field"><LockKeyhole size={17} /><input required value={inviteCode} onChange={e => setInviteCode(e.target.value.trim())} placeholder={t("كود دعوة الشركة")} dir="ltr" /></label>}
        </>}
        {mode !== "reset" && <label className="auth-field"><Mail size={17} /><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("البريد الإلكتروني")} dir="ltr" /></label>}
        {mode !== "forgot" && <label className="auth-field"><LockKeyhole size={17} /><input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("كلمة المرور (8 أحرف على الأقل)")} dir="ltr" /></label>}
        {error && <div className="auth-message error">{error}</div>}
        {message && <div className="auth-message success"><CheckCircle2 size={17} />{message}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? t("جارٍ المعالجة...") : mode === "login" ? t("دخول إلى المنصة") : mode === "register" ? t("إنشاء الحساب") : mode === "forgot" ? t("إرسال رابط الاستعادة") : t("حفظ كلمة المرور")}</button>
      </form>
      <div className="auth-links">
        {mode === "login" && <><button onClick={() => navigate("/forgot-password")}>{t("نسيت كلمة المرور؟")}</button><span>{t("ليس لديك حساب؟")} <button onClick={() => navigate("/register")}>{t("إنشاء حساب")}</button></span></>}
        {mode === "register" && <span>{t("لديك حساب؟")} <button onClick={() => navigate("/login")}>{t("تسجيل الدخول")}</button></span>}
        {mode === "forgot" && <button onClick={() => navigate("/login")}><ArrowLeft size={15} /> {t("العودة للدخول")}</button>}
        {mode === "reset" && <button onClick={() => navigate("/login")}>{t("العودة للدخول")}</button>}
      </div>
      <small className="auth-security"><LockKeyhole size={13} /> {t("جلسة مشفرة وبيانات كل شركة معزولة")}</small>
    </section>
  </main>;
}
