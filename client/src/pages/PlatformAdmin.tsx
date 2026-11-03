import { useMemo, useState } from "react";
import {
  Activity, Building2, CalendarDays, CheckCircle2, CircleAlert, Clock3,
  Globe2, LayoutDashboard, LogOut, RefreshCw, Search, ShieldCheck,
  Store, Users, Wallet,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

type Language = "ar" | "en" | "ru";
type StatusFilter = "all" | "active" | "trial" | "suspended";
type TenantRow = { id:number; name:string; slug:string; city:string|null; countryCode:string|null; currency:string; status:string; createdAt:Date|string; planKey:string|null; staffLimit:number|null; monthlyPriceCents:number|null; planCurrency:string|null; subscriptionStatus:string|null; currentPeriodStart:Date|string|null; currentPeriodEnd:Date|string|null; gracePeriodEndsAt:Date|string|null; graceDays:number|null; autoRenew:number|null };

const copy = {
  ar: {
    brand:"Clientora", kicker:"مركز التحكم المركزي", title:"لوحة إدارة المنصة", subtitle:"نظرة تشغيلية على الشركات المسجلة في Clientora.",
    overview:"نظرة عامة", companies:"الشركات", security:"وصول آمن", readOnly:"إدارة الاشتراكات",
    total:"إجمالي الشركات", active:"اشتراكات نشطة", trial:"فترة تجريبية", suspended:"موقوفة",
    directory:"دليل الشركات", directoryHint:"قائمة الشركات المسجلة وحالتها الحالية", search:"ابحث بالاسم أو الرابط أو المدينة",
    all:"الكل", refresh:"تحديث", company:"الشركة", location:"المدينة", country:"الدولة", plan:"الباقة", renewal:"موعد التجديد", noPlan:"لم يختر باقة", choosePlan:"اختر الباقة", savePlan:"حفظ الباقة", actions:"الإجراءات", activate:"تشغيل", suspendAction:"إيقاف", renew:"تجديد شهر", autoRenewOn:"إيقاف التجديد التلقائي", autoRenewOff:"تفعيل التجديد التلقائي", pending:"بانتظار التفعيل", pastDue:"متأخر عن السداد", cancelled:"ملغي", status:"الحالة", created:"تاريخ التسجيل", id:"المعرّف",
    empty:"لا توجد شركات تطابق البحث.", none:"لا توجد شركات مسجلة حتى الآن.", loading:"جارٍ تحميل بيانات الشركات…",
    error:"تعذر تحميل البيانات. تحقق من الاتصال ثم حاول مجدداً.", retry:"إعادة المحاولة", logout:"تسجيل الخروج",
    activeLabel:"نشطة", trialLabel:"تجريبية", suspendedLabel:"موقوفة", noCity:"غير محدد",
    noteTitle:"ملاحظات الدفع والتجديد التلقائي", note:"يمكنك اختيار الباقة وتشغيل الاشتراك أو إيقافه وتجديده يدوياً. خيار التجديد التلقائي يحفظ التفضيل فقط ولا يخصم أي مبلغ؛ ربط بوابة الدفع والتنفيذ المجدول لانتهاء مهلة السماح يحتاجان مرحلة منفصلة.",
    recent:"أحدث الشركات", recentHint:"آخر الشركات التي انضمت إلى المنصة", days:"تاريخ الانضمام",
    noMutations:"كل إجراء إداري يُحفظ في سجل الاشتراكات.",
  },
  en: {
    brand:"Clientora", kicker:"CENTRAL CONTROL", title:"Platform command center", subtitle:"An operational overview of companies registered on Clientora.",
    overview:"Overview", companies:"Companies", security:"Secure access", readOnly:"Subscription management",
    total:"Total companies", active:"Active", trial:"On trial", suspended:"Suspended",
    directory:"Company directory", directoryHint:"Registered companies and their current status", search:"Search name, slug or city",
    all:"All", refresh:"Refresh", company:"Company", location:"City", country:"Country", plan:"Plan", renewal:"Renewal", noPlan:"No plan selected", choosePlan:"Choose plan", savePlan:"Save plan", actions:"Actions", activate:"Activate", suspendAction:"Suspend", renew:"Renew 1 month", autoRenewOn:"Turn auto-renew off", autoRenewOff:"Turn auto-renew on", pending:"Pending activation", pastDue:"Past due", cancelled:"Cancelled", status:"Status", created:"Created", id:"ID",
    empty:"No companies match this search.", none:"No companies registered yet.", loading:"Loading company data…",
    error:"Could not load data. Check the connection and try again.", retry:"Try again", logout:"Sign out",
    activeLabel:"Active", trialLabel:"Trial", suspendedLabel:"Suspended", noCity:"Not specified",
    noteTitle:"Payments and automatic renewal", note:"You can select a plan, activate, suspend or manually renew a subscription. The auto-renew switch only stores the preference and does not charge a payment method; payment gateway integration and scheduled grace-period enforcement are a separate phase.",
    recent:"Recently joined", recentHint:"The latest companies to join the platform", days:"Join date",
    noMutations:"Every admin action is recorded in the subscription audit log.",
  },
  ru: {
    brand:"Clientora", kicker:"ЦЕНТР УПРАВЛЕНИЯ", title:"Панель администратора", subtitle:"Операционная сводка компаний, зарегистрированных в Clientora.",
    overview:"Обзор", companies:"Компании", security:"Безопасный доступ", readOnly:"Управление подписками",
    total:"Всего компаний", active:"Активные", trial:"Пробный период", suspended:"Приостановлены",
    directory:"Список компаний", directoryHint:"Зарегистрированные компании и их текущий статус", search:"Поиск по названию, адресу или городу",
    all:"Все", refresh:"Обновить", company:"Компания", location:"Город", country:"Страна", plan:"Тариф", renewal:"Продление", noPlan:"Тариф не выбран", choosePlan:"Выберите тариф", savePlan:"Сохранить тариф", actions:"Действия", activate:"Включить", suspendAction:"Приостановить", renew:"Продлить на месяц", autoRenewOn:"Отключить автопродление", autoRenewOff:"Включить автопродление", pending:"Ожидает активации", pastDue:"Просрочен", cancelled:"Отменён", status:"Статус", created:"Дата регистрации", id:"ID",
    empty:"Компании не найдены.", none:"Пока нет зарегистрированных компаний.", loading:"Загрузка данных…",
    error:"Не удалось загрузить данные. Проверьте соединение и повторите попытку.", retry:"Повторить", logout:"Выйти",
    activeLabel:"Активна", trialLabel:"Пробная", suspendedLabel:"Приостановлена", noCity:"Не указано",
    noteTitle:"Платежи и автопродление", note:"Можно выбрать тариф, включить, приостановить или продлить подписку вручную. Переключатель автопродления только сохраняет настройку и не списывает деньги; подключение платежного шлюза и автоматическая проверка льготного периода — отдельный этап.",
    recent:"Новые компании", recentHint:"Последние компании, присоединившиеся к платформе", days:"Дата регистрации",
    noMutations:"Каждое действие администратора сохраняется в журнале подписок.",
  },
} satisfies Record<Language, Record<string,string>>;

const statusMeta = {
  active: { tone:"green", icon:CheckCircle2 },
  trial: { tone:"amber", icon:Clock3 },
  suspended: { tone:"red", icon:CircleAlert },
} as const;

export default function PlatformAdmin() {
  const { language } = useLanguage();
  const lang:Language = language === "ar" || language === "ru" ? language : "en";
  const t = copy[lang];
  const rtl = lang === "ar";
  const tenants = trpc.platform.tenants.useQuery(undefined, { retry:1, refetchOnWindowFocus:true });
  const plans = trpc.platform.subscriptionPlans.useQuery();
  const [selectedPlans, setSelectedPlans] = useState<Record<number,string>>({});
  const subscriptionAction = trpc.platform.subscriptionAction.useMutation({
    onSuccess: () => { void tenants.refetch(); },
  });
  const logout = trpc.auth.logout.useMutation({ onSuccess:() => window.location.assign("/login") });
  const [query,setQuery] = useState("");
  const [filter,setFilter] = useState<StatusFilter>("all");
  const [section,setSection] = useState<"overview"|"companies">("overview");

  const rows = (tenants.data ?? []) as TenantRow[];
  const counts = useMemo(() => ({
    all:rows.length,
    active:rows.filter(x=>x.status==="active").length,
    trial:rows.filter(x=>x.status==="trial").length,
    suspended:rows.filter(x=>x.status==="suspended").length,
  }),[rows]);
  const filtered = useMemo(() => rows.filter(row => {
    const q=query.trim().toLocaleLowerCase();
    const matches = !q || [row.name,row.slug,row.city ?? "",row.countryCode ?? "",row.planKey ?? "",String(row.id)].some(v=>v.toLocaleLowerCase().includes(q));
    return matches && (filter==="all" || row.status===filter);
  }),[rows,query,filter]);
  const formatDate = (value:Date|string) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(lang==="ar"?"ar-OM":lang==="ru"?"ru-RU":"en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(d);
  };
  const countryLabel = (code:string|null) => {
    if (!code) return t.noCity;
    try {
      return new Intl.DisplayNames([lang==="ar"?"ar-OM":lang==="ru"?"ru-RU":"en"], { type:"region" }).of(code) ?? code;
    } catch { return code; }
  };
  const planLabel = (row:TenantRow) => row.planKey && row.monthlyPriceCents !== null
    ? `${row.planKey} · ${(row.monthlyPriceCents / 100).toFixed(0)}/mo · ${row.staffLimit} staff`
    : t.noPlan;
  const renewalLabel = (row:TenantRow) => row.currentPeriodEnd ? formatDate(row.currentPeriodEnd) : "—";
  const label = (status:string) => status==="active"?t.activeLabel:status==="trial"?t.trialLabel:status==="suspended"?t.suspendedLabel:status;
  const subscriptionLabel = (status:string|null) => status==="pending"?t.pending:status==="past_due"?t.pastDue:status==="cancelled"?t.cancelled:status==="suspended"?t.suspendedLabel:status==="active"?t.activeLabel:"—";
  const nav = [{id:"overview" as const,label:t.overview,icon:LayoutDashboard},{id:"companies" as const,label:t.companies,icon:Building2}];

  const Stat = ({title,value,icon:Icon,tone,detail}:{title:string;value:number;icon:typeof Store;tone:string;detail:string}) => (
    <article className="sa-stat">
      <div className="sa-stat-top"><span>{title}</span><span className={"sa-stat-icon "+tone}><Icon size={19}/></span></div>
      <div className="sa-stat-value">{value.toLocaleString(lang==="ar"?"ar-OM":lang==="ru"?"ru-RU":"en-US")}</div>
      <div className="sa-stat-detail">{detail}</div>
    </article>
  );

  return (
    <main className="sa-shell" dir={rtl?"rtl":"ltr"}>
      <style>{`
        .sa-shell{--ink:#142c29;--muted:#71827e;--line:#e5ece9;--paper:#fff;--canvas:#f4f7f6;min-height:100vh;background:var(--canvas);color:var(--ink);font-family:inherit}
        .sa-layout{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh}
        .sa-side{background:#102d2a;color:#e8f4f0;padding:26px 18px;display:flex;flex-direction:column;gap:32px}
        .sa-brand{display:flex;align-items:center;gap:12px;padding:0 8px}
        .sa-brand-mark{width:42px;height:42px;border-radius:14px;background:#20a18e;display:grid;place-items:center;color:white}
        .sa-brand-name{font-size:19px;font-weight:850;letter-spacing:-.5px}.sa-brand-sub{font-size:10px;color:#91b4aa;letter-spacing:1.5px;margin-top:2px}
        .sa-nav-label{font-size:10px;color:#7fa49a;font-weight:800;letter-spacing:1.4px;padding:0 12px;margin-bottom:10px}
        .sa-nav{display:grid;gap:6px}.sa-nav button{border:0;background:transparent;color:#b7cbc5;display:flex;align-items:center;gap:12px;padding:12px;border-radius:11px;text-align:start;font:inherit;font-size:13px;cursor:pointer}
        .sa-nav button.active{background:#1b4942;color:#fff;box-shadow:inset 3px 0 #41c3ad}.sa-side-foot{margin-top:auto;border-top:1px solid #2b4c46;padding:18px 8px 0;color:#9bb7ae;font-size:11px;line-height:1.7}
        .sa-main{padding:30px clamp(18px,3vw,42px) 44px;min-width:0;max-width:1600px;width:100%;margin:0 auto}
        .sa-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:34px}.sa-crumb{color:var(--muted);font-size:12px;display:flex;align-items:center;gap:8px}.sa-top-actions{display:flex;align-items:center;gap:10px}
        .sa-secure{display:flex;align-items:center;gap:7px;background:#e7f4ef;color:#237765;border:1px solid #cfe7de;border-radius:30px;padding:8px 12px;font-size:11px;font-weight:750}
        .sa-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line);background:white;color:#405b55;border-radius:10px;padding:9px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.sa-btn:disabled{opacity:.55;cursor:wait}
        .sa-heading{margin-bottom:24px}.sa-eyebrow{font-size:10px;font-weight:850;letter-spacing:1.8px;color:#168b7a;margin-bottom:9px}.sa-heading h1{font-size:clamp(25px,3vw,34px);line-height:1.2;letter-spacing:-.8px;margin:0 0 8px;font-weight:850}.sa-heading p{margin:0;color:var(--muted);font-size:13px}
        .sa-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:24px 0}.sa-stat{background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:18px 19px;box-shadow:0 5px 20px #153b3210}.sa-stat-top{display:flex;justify-content:space-between;align-items:center;gap:8px;color:#637772;font-size:12px;font-weight:700}.sa-stat-icon{width:36px;height:36px;border-radius:11px;display:grid;place-items:center}.sa-stat-icon.teal{background:#e7f5f1;color:#138775}.sa-stat-icon.green{background:#e9f6ed;color:#27834d}.sa-stat-icon.amber{background:#fff5e3;color:#ad781c}.sa-stat-icon.red{background:#fff0ee;color:#b34e45}.sa-stat-value{font-size:30px;font-weight:850;letter-spacing:-1px;margin:13px 0 4px;font-variant-numeric:tabular-nums}.sa-stat-detail{font-size:10px;color:#91a09b}
        .sa-panel{background:white;border:1px solid var(--line);border-radius:16px;box-shadow:0 5px 20px #153b3209;overflow:hidden;margin-top:18px}.sa-panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:19px 21px;border-bottom:1px solid #edf1ef}.sa-panel-title{font-size:14px;font-weight:850}.sa-panel-hint{font-size:11px;color:var(--muted);margin-top:4px}
        .sa-search-wrap{position:relative;min-width:min(290px,100%)}.sa-search-wrap svg{position:absolute;top:50%;transform:translateY(-50%);inset-inline-start:12px;color:#8b9a95}.sa-search{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;background:#fbfcfc;padding:10px 36px 10px 12px;font:inherit;font-size:12px;outline:none}.sa-search:focus{border-color:#59ad9e;box-shadow:0 0 0 3px #59ad9e22}
        .sa-filters{display:flex;align-items:center;gap:7px;padding:13px 20px;border-bottom:1px solid #edf1ef;flex-wrap:wrap}.sa-filter{border:1px solid transparent;border-radius:20px;padding:6px 11px;background:transparent;color:#71827e;font:inherit;font-size:11px;font-weight:700;cursor:pointer}.sa-filter.active{background:#e8f5f1;color:#137b6d;border-color:#d3ebe3}
        .sa-table-wrap{overflow:auto} .sa-table{width:100%;border-collapse:collapse;min-width:1120px;text-align:start}.sa-plan-cell{display:flex;align-items:center;gap:6px}.sa-plan-select{max-width:170px;border:1px solid var(--line);border-radius:8px;padding:7px;background:#fff;color:var(--ink);font:inherit;font-size:11px}.sa-mini{padding:6px 8px;font-size:10px}.sa-row-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap;max-width:260px}.sa-table th{background:#fafcfb;color:#82918c;font-size:10px;font-weight:800;padding:12px 18px;white-space:nowrap}.sa-table td{padding:14px 18px;border-top:1px solid #eff3f1;font-size:12px;white-space:nowrap}.sa-table tr:hover td{background:#fbfdfc}
        .sa-company{display:flex;align-items:center;gap:11px}.sa-company-mark{width:35px;height:35px;border-radius:11px;background:#eaf4f1;color:#188675;display:grid;place-items:center}.sa-company-name{font-weight:800}.sa-company-slug{font-size:10px;color:#91a09b;margin-top:3px;direction:ltr;text-align:start}.sa-id{font-variant-numeric:tabular-nums;color:#82918c}.sa-status{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:20px;font-size:10px;font-weight:800}.sa-status.green{background:#eaf6ee;color:#267a49}.sa-status.amber{background:#fff5e5;color:#9b6b19}.sa-status.red{background:#fff0ee;color:#ad4c43}
        .sa-empty,.sa-loading{padding:42px 18px;text-align:center;color:var(--muted);font-size:12px}.sa-empty-icon{width:44px;height:44px;border-radius:14px;background:#eff5f3;color:#7b9a90;display:grid;place-items:center;margin:0 auto 12px}
        .sa-note{display:flex;gap:12px;padding:16px 18px;border:1px solid #f0dfb9;background:#fffaf0;color:#765a25;border-radius:13px;margin-top:18px}.sa-note strong{display:block;font-size:12px;margin-bottom:5px}.sa-note p{font-size:11px;line-height:1.7;margin:0;color:#8a7040}
        .sa-recent{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:16px 20px}.sa-recent-item{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 12px;border:1px solid #edf2ef;border-radius:11px}.sa-recent-name{font-size:12px;font-weight:750}.sa-recent-date{font-size:10px;color:#8a9993;margin-top:3px}
        .sa-mobile-brand{display:none}
        @media(max-width:900px){.sa-layout{grid-template-columns:205px minmax(0,1fr)}.sa-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:650px){.sa-layout{display:block}.sa-side{padding:13px 15px;gap:12px}.sa-brand{padding:0 3px}.sa-brand-mark{width:35px;height:35px}.sa-brand-name{font-size:16px}.sa-brand-sub{display:none}.sa-nav-label,.sa-side-foot{display:none}.sa-nav{display:flex;overflow:auto}.sa-nav button{padding:9px 11px;white-space:nowrap;font-size:11px}.sa-main{padding:20px 14px 32px}.sa-topbar{margin-bottom:23px}.sa-crumb{display:none}.sa-secure{font-size:10px;padding:7px 9px}.sa-stats{gap:9px}.sa-stat{padding:14px}.sa-stat-value{font-size:25px}.sa-panel-head{align-items:flex-start;flex-direction:column}.sa-search-wrap{width:100%;min-width:0}.sa-recent{grid-template-columns:1fr}.sa-note{padding:13px}}
      `}</style>
      <div className="sa-layout">
        <aside className="sa-side">
          <div className="sa-brand"><div className="sa-brand-mark"><ShieldCheck size={22}/></div><div><div className="sa-brand-name">{t.brand}</div><div className="sa-brand-sub">SUPER ADMIN</div></div></div>
          <div><div className="sa-nav-label">{t.kicker}</div><nav className="sa-nav">{nav.map(item=><button key={item.id} className={section===item.id?"active":""} onClick={()=>setSection(item.id)}><item.icon size={17}/>{item.label}</button>)}</nav></div>
          <div className="sa-side-foot"><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><ShieldCheck size={14}/>{t.security}</div>{t.readOnly}<br/>{t.noMutations}</div>
        </aside>
        <section className="sa-main">
          <div className="sa-topbar"><div className="sa-crumb"><LayoutDashboard size={14}/>{t.brand}<span> / </span>{section==="overview"?t.overview:t.companies}</div><div className="sa-top-actions"><span className="sa-secure"><ShieldCheck size={14}/>{t.readOnly}</span><button className="sa-btn" onClick={()=>logout.mutate()} disabled={logout.isPending}><LogOut size={15}/>{t.logout}</button></div></div>
          <header className="sa-heading"><div className="sa-eyebrow">{t.kicker}</div><h1>{section==="overview"?t.title:t.directory}</h1><p>{section==="overview"?t.subtitle:t.directoryHint}</p></header>
          {tenants.isLoading ? <div className="sa-panel sa-loading">{t.loading}</div> : tenants.isError ? <div className="sa-panel sa-empty"><div className="sa-empty-icon"><CircleAlert size={21}/></div><p>{t.error}</p><button className="sa-btn" onClick={()=>tenants.refetch()}><RefreshCw size={14}/>{t.retry}</button></div> : <>
            <div className="sa-stats">
              <Stat title={t.total} value={counts.all} icon={Building2} tone="teal" detail={t.directoryHint}/>
              <Stat title={t.active} value={counts.active} icon={CheckCircle2} tone="green" detail={t.activeLabel}/>
              <Stat title={t.trial} value={counts.trial} icon={Clock3} tone="amber" detail={t.trialLabel}/>
              <Stat title={t.suspended} value={counts.suspended} icon={CircleAlert} tone="red" detail={t.suspendedLabel}/>
            </div>
            {section==="overview" && <section className="sa-panel"><div className="sa-panel-head"><div><div className="sa-panel-title">{t.recent}</div><div className="sa-panel-hint">{t.recentHint}</div></div><button className="sa-btn" onClick={()=>setSection("companies")}>{t.companies}</button></div>
              {rows.length===0?<div className="sa-empty">{t.none}</div>:<div className="sa-recent">{rows.slice(0,6).map(row=><div className="sa-recent-item" key={row.id}><div className="sa-company"><div className="sa-company-mark"><Store size={17}/></div><div><div className="sa-recent-name">{row.name}</div><div className="sa-company-slug">{row.slug}</div></div></div><div className="sa-recent-date">{formatDate(row.createdAt)}</div></div>)}</div>}
            </section>}
            <section className="sa-panel">
              <div className="sa-panel-head"><div><div className="sa-panel-title">{t.directory}</div><div className="sa-panel-hint">{t.directoryHint}</div></div><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",width:"min(100%,420px)"}}><div className="sa-search-wrap"><Search size={15}/><input className="sa-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div><button className="sa-btn" onClick={()=>tenants.refetch()} disabled={tenants.isFetching}><RefreshCw size={14}/>{t.refresh}</button></div></div>
              <div className="sa-filters">{(["all","active","trial","suspended"] as StatusFilter[]).map(key=><button key={key} className={"sa-filter "+(filter===key?"active":"")} onClick={()=>setFilter(key)}>{key==="all"?t.all:key==="active"?t.activeLabel:key==="trial"?t.trialLabel:t.suspendedLabel} ({key==="all"?counts.all:counts[key]})</button>)}</div>
              {filtered.length===0?<div className="sa-empty"><div className="sa-empty-icon"><Store size={21}/></div>{rows.length?t.empty:t.none}</div>:<div className="sa-table-wrap"><table className="sa-table"><thead><tr><th>{t.id}</th><th>{t.company}</th><th>{t.location}</th><th>{t.country}</th><th>{t.plan}</th><th>{t.status}</th><th>{t.renewal}</th><th>{t.created}</th><th>{t.actions}</th></tr></thead><tbody>{filtered.map(row=>{const meta=statusMeta[row.status as keyof typeof statusMeta];const Icon=meta?.icon??Activity;return <tr key={row.id}><td className="sa-id">#{row.id}</td><td><div className="sa-company"><div className="sa-company-mark"><Store size={17}/></div><div><div className="sa-company-name">{row.name}</div><div className="sa-company-slug">{row.slug}</div></div></div></td><td>{row.city||t.noCity}</td><td>{countryLabel(row.countryCode)}</td><td><div className="sa-plan-cell"><select className="sa-plan-select" value={selectedPlans[row.id] ?? row.planKey ?? ""} onChange={e=>setSelectedPlans(current=>({...current,[row.id]:e.target.value}))}><option value="">{t.choosePlan}</option>{(plans.data??[]).map(plan=><option key={plan.planKey} value={plan.planKey}>{plan.planKey} · ${(plan.monthlyPriceCents/100).toFixed(0)} · {plan.staffLimit} staff</option>)}</select><button className="sa-btn sa-mini" disabled={subscriptionAction.isPending || !(selectedPlans[row.id] ?? row.planKey)} onClick={()=>subscriptionAction.mutate({tenantId:row.id,action:"select_plan",planKey:selectedPlans[row.id] ?? row.planKey ?? undefined})}>{t.savePlan}</button></div></td><td><span className={"sa-status "+(meta?.tone??"amber")}><Icon size={12}/>{label(row.status)}</span>{row.subscriptionStatus?<div className="sa-company-slug">{subscriptionLabel(row.subscriptionStatus)}</div>:null}</td><td>{renewalLabel(row)}</td><td>{formatDate(row.createdAt)}</td><td><div className="sa-row-actions"><button className="sa-btn sa-mini" disabled={subscriptionAction.isPending || !row.planKey} onClick={()=>subscriptionAction.mutate({tenantId:row.id,action:"activate"})}>{t.activate}</button><button className="sa-btn sa-mini" disabled={subscriptionAction.isPending || row.status==="suspended"} onClick={()=>subscriptionAction.mutate({tenantId:row.id,action:"suspend"})}>{t.suspendAction}</button><button className="sa-btn sa-mini" disabled={subscriptionAction.isPending || !row.planKey} onClick={()=>subscriptionAction.mutate({tenantId:row.id,action:"renew"})}>{t.renew}</button><button className="sa-btn sa-mini" disabled={subscriptionAction.isPending || !row.planKey} onClick={()=>subscriptionAction.mutate({tenantId:row.id,action:"set_auto_renew",autoRenew:row.autoRenew!==1})}>{row.autoRenew===1?t.autoRenewOn:t.autoRenewOff}</button></div></td></tr>})}</tbody></table></div>}
            </section>
            <div className="sa-note"><CircleAlert size={18} style={{flexShrink:0,marginTop:1}}/><div><strong>{t.noteTitle}</strong><p>{t.note}</p></div></div>
          </>}
        </section>
      </div>
    </main>
  );
}
