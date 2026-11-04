import { useState, type FormEvent } from "react";
import { Redirect, useLocation } from "wouter";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

export function PlatformLogin() {
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const auth = trpc.auth.me.useQuery();
  const login = trpc.auth.login.useMutation();
  const logout = trpc.auth.logout.useMutation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (auth.isLoading) return <div className="auth-loading">{t("جارٍ التحقق من الجلسة...")}</div>;
  if (auth.data?.role === "admin") return <Redirect to="/platform" />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login.mutateAsync({ email, password, remember: true });
      if (user.role !== "admin") {
        await logout.mutateAsync();
        setError(t("هذا الحساب ليس لديه صلاحية إدارة المنصة."));
        return;
      }
      await utils.auth.me.invalidate();
      navigate("/platform");
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t("تعذر تسجيل الدخول. حاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  };

  return <main dir={language === "ar" ? "rtl" : "ltr"} style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"linear-gradient(145deg,#102d2a,#17463f 55%,#eef5f2)", fontFamily:"inherit" }}>
    <section style={{ width:"min(100%,430px)", boxSizing:"border-box", background:"#fff", border:"1px solid #dce9e4", borderRadius:24, padding:"clamp(24px,5vw,38px)", boxShadow:"0 24px 70px #071f1c55", color:"#173b35" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:30 }}>
        <span style={{ width:48, height:48, borderRadius:15, display:"grid", placeItems:"center", color:"#fff", background:"#0d8f83" }}><ShieldCheck size={25}/></span>
        <div><b style={{ fontSize:21 }}>Clientora</b><div style={{ color:"#648078", fontSize:12, marginTop:3 }}>{t("إدارة المنصة المركزية")}</div></div>
      </div>
      <div style={{ color:"#0d8f83", fontSize:12, fontWeight:800, letterSpacing:1 }}>{t("دخول خاص بالإدارة")}</div>
      <h1 style={{ fontSize:27, margin:"9px 0" }}>{t("مرحباً بعودتك")}</h1>
      <p style={{ color:"#687b78", lineHeight:1.7, margin:"0 0 24px" }}>{t("هذه البوابة مخصصة لصاحب منصة Clientora فقط. يجب استخدام حساب إدارة معتمد مسبقاً.")}</p>
      <form onSubmit={submit} style={{ display:"grid", gap:14 }}>
        <label style={{ display:"grid", gap:7, fontSize:13, fontWeight:700 }}>{t("البريد الإلكتروني")}<span style={{ display:"flex", alignItems:"center", gap:9, border:"1px solid #d9e4e1", borderRadius:11, padding:"0 12px" }}><Mail size={17} color="#78918a"/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" dir="ltr" style={{ border:0, outline:0, padding:"13px 0", width:"100%", font:"inherit" }}/></span></label>
        <label style={{ display:"grid", gap:7, fontSize:13, fontWeight:700 }}>{t("كلمة المرور")}<span style={{ display:"flex", alignItems:"center", gap:9, border:"1px solid #d9e4e1", borderRadius:11, padding:"0 12px" }}><LockKeyhole size={17} color="#78918a"/><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" dir="ltr" style={{ border:0, outline:0, padding:"13px 0", width:"100%", font:"inherit" }}/></span></label>
        {error && <p role="alert" style={{ margin:0, color:"#b42318", fontSize:13 }}>{error}</p>}
        <button disabled={busy} style={{ border:0, borderRadius:12, padding:14, background:busy?"#9bbcb4":"#0d8f83", color:"#fff", fontWeight:800, fontSize:14, cursor:busy?"wait":"pointer" }}>{busy?t("جارٍ التحقق..."):t("دخول لوحة إدارة المنصة")}</button>
      </form>
      <div style={{ borderTop:"1px solid #edf1f0", marginTop:22, paddingTop:16, color:"#78918a", fontSize:11, display:"flex", alignItems:"center", gap:7 }}><ShieldCheck size={14}/>{t("صلاحية الدخول يتم التحقق منها على الخادم.")}</div>
      <button type="button" onClick={()=>navigate("/login")} style={{ marginTop:16, padding:0, border:0, background:"transparent", color:"#0d8f83", fontWeight:700, cursor:"pointer" }}>{t("العودة إلى دخول العملاء والموظفين")}</button>
    </section>
  </main>;
}

function ProtectedPlatformAdmin() {
  const auth = trpc.auth.me.useQuery();
  if (auth.isLoading) return <div className="auth-loading">جارٍ التحقق من صلاحية إدارة المنصة...</div>;
  if (!auth.data) return <Redirect to="/platform/login" />;
  if (auth.data.role !== "admin") return <Redirect to="/" />;
  return <PlatformAdmin />;
}

