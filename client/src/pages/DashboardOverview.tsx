import { useMemo } from "react";
import { Bell, CalendarDays, Clock3, CreditCard, Sparkles, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

type BookingRow = {
  id: number; date: string; clientName: string; clientPhone: string; serviceName: string;
  staffId: number; startMinutes: number; durationMinutes: number; price: number;
  status: "new" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";
  paid: number; note: string | null;
};

const pad = (value:number) => String(value).padStart(2,"0");
const timeLabel = (value:number) => `${pad(Math.floor(value/60))}:${pad(value%60)}`;
const dateInZone = (date:Date, timezone:string) => {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const values = Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const addDays = (iso:string, days:number) => {
  const date = new Date(iso+"T12:00:00Z"); date.setUTCDate(date.getUTCDate()+days); return date.toISOString().slice(0,10);
};
const weekdayNames: Record<"ar" | "en" | "ru" | "fr" | "it", string[]> = { ar:["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"], en:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], ru:["Вс","Пн","Вт","Ср","Чт","Пт","Сб"], fr:["dim.","lun.","mar.","mer.","jeu.","ven.","sam."], it:["dom","lun","mar","mer","gio","ven","sab"] };

export default function DashboardOverview({tenantId,timezone,currency,workspaceName}:{tenantId?:number;timezone:string;currency:string;workspaceName:string}) {
  const {language,t} = useLanguage();
  const weekdays = weekdayNames[language];
  const today = dateInZone(new Date(),timezone);
  const endDate = addDays(today,6);
  const query = trpc.workspace.bookings.useQuery(
    {tenantId:tenantId??0,date:today,endDate},
    {enabled:Boolean(tenantId),refetchInterval:60000}
  );
  const rows = (query.data ?? []) as BookingRow[];
  const todayRows = useMemo(()=>rows.filter(row=>row.date===today),[rows,today]);
  const activeToday = todayRows.filter(row=>row.status!=="cancelled");
  const paidRevenue = todayRows.filter(row=>Boolean(row.paid)).reduce((sum,row)=>sum+Number(row.price||0),0);
  const uniqueClients = new Set(todayRows.map(row=>row.clientPhone||row.clientName)).size;
  const noShowCount = todayRows.filter(row=>row.status==="no_show").length;
  const noShowRate = activeToday.length ? (noShowCount/activeToday.length)*100 : 0;
  const chartData = useMemo(()=>Array.from({length:7},(_,index)=>{
    const date=addDays(today,index);
    const count=rows.filter(row=>row.date===date&&row.status!=="cancelled").length;
    return {day:weekdays[new Date(date+"T12:00:00Z").getUTCDay()],bookings:count};
  }),[rows,today]);
  const demandData = useMemo(()=>[9,12,15,18,21].map(hour=>({
    time:new Intl.DateTimeFormat(language==="en"?"en-GB":language==="ru"?"ru-RU":language==="fr"?"fr-FR":language==="it"?"it-IT":"ar-OM",{hour:"numeric",hour12:true,timeZone:timezone}).format(new Date(`${today}T${String(hour).padStart(2,"0")}:00:00`)),
    count:rows.filter(row=>row.date===today&&Math.floor(row.startMinutes/60)>=hour&&Math.floor(row.startMinutes/60)<hour+3&&row.status!=="cancelled").length
  })),[rows,today,language,timezone]);
  const peak = [...demandData].sort((a,b)=>b.count-a.count)[0];
  const nowMinutes = (()=>{const parts=new Intl.DateTimeFormat("en-GB",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()).split(":").map(Number);return parts[0]*60+parts[1];})();
  const upcoming = [...todayRows].filter(row=>row.startMinutes>=nowMinutes&&row.status!=="cancelled").sort((a,b)=>a.startMinutes-b.startMinutes).slice(0,5);
  const locale = language === "en" ? "en-GB" : language === "ru" ? "ru-RU" : language === "fr" ? "fr-FR" : language === "it" ? "it-IT" : "ar-OM";
  const dateLabel = new Intl.DateTimeFormat(locale,{timeZone:timezone,weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
  const money = (value:number)=>new Intl.NumberFormat(language==="ar"?"ar-OM":language==="ru"?"ru-RU":language==="fr"?"fr-FR":language==="it"?"it-IT":"en-GB",{minimumFractionDigits:0,maximumFractionDigits:2}).format(value)+" "+currency;

  return <div className="clientora-dashboard">
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow"><span className="dashboard-live-dot"/> {dateLabel}</span><h1>{t("أهلاً بك 👋")}</h1><p>{t("إليك ملخص أداء ")}<b>{workspaceName}</b> {t("اليوم.")}</p></div>
      <div className="dashboard-date"><CalendarDays size={18}/>{dateLabel}</div>
    </div>
    {query.isLoading ? <div className="dashboard-loading">{t("جارٍ تحميل بيانات لوحة التحكم...")}</div> : query.isError ? <div className="dashboard-empty">{t("تعذر تحميل بيانات لوحة التحكم. حاول تحديث الصفحة.")}</div> : <>
      <div className="dashboard-kpis">
        <article className="dashboard-kpi"><div className="kpi-icon purple"><CalendarDays/></div><div><span>{t("حجوزات اليوم")}</span><strong>{todayRows.length}</strong><small>{t("الحجوزات المسجلة اليوم")}</small></div></article>
        <article className="dashboard-kpi"><div className="kpi-icon green"><Users/></div><div><span>{t("العملاء اليوم")}</span><strong>{uniqueClients}</strong><small>{t("عملاء لديهم حجز اليوم")}</small></div></article>
        <article className="dashboard-kpi"><div className="kpi-icon violet"><CreditCard/></div><div><span>{t("الإيراد المحصّل")}</span><strong>{money(paidRevenue)}</strong><small>{t("من الحجوزات المدفوعة اليوم")}</small></div></article>
        <article className="dashboard-kpi"><div className="kpi-icon pink"><TrendingUp/></div><div><span>{t("عدم الحضور")}</span><strong>{noShowRate.toFixed(1)}%</strong><small>{noShowCount}{t(" حجز لم يحضر")}</small></div></article>
      </div>
      <div className="dashboard-analytics">
        <section className="dashboard-panel bookings-chart-panel"><div className="dashboard-panel-heading"><div><h2>{t("نظرة على الحجوزات")}</h2><p>{t("الحجوزات خلال الأيام السبعة القادمة")}</p></div><span className="chart-legend"><i/> {t("الحجوزات")}</span></div>
          {rows.length===0?<div className="dashboard-chart-empty">{t("لا توجد حجوزات مسجلة في هذه الفترة حتى الآن.")}</div>:<div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:12,right:8,left:-18,bottom:0}}><defs><linearGradient id="bookingFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7545e8" stopOpacity={0.24}/><stop offset="95%" stopColor="#7545e8" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke="#eeeaf8" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:"#7b7890",fontSize:11}}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:"#9692a8",fontSize:10}}/><Tooltip contentStyle={{borderRadius:12,border:"1px solid #eeeaf8",fontSize:12}}/><Area type="monotone" dataKey="bookings" name={t("الحجوزات")} stroke="#7545e8" strokeWidth={3} fill="url(#bookingFill)" activeDot={{r:5}}/></AreaChart></ResponsiveContainer></div>}
        </section>
        <section className="dashboard-panel demand-panel"><div className="dashboard-panel-heading"><div><h2>{t("أوقات الطلب")}</h2><p>{t("توزيع الحجوزات حسب وقت البداية اليوم")}</p></div><span className="demand-bolt"><Sparkles size={17}/></span></div><div className="peak-summary"><div><small>{t("أكثر فترة ازدحاماً")}</small><strong>{peak?.count ? peak.time : t("لا توجد بيانات")}</strong></div><div><small>{t("عدد الحجوزات")}</small><strong>{peak?.count ?? 0}</strong></div></div><div className="demand-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={demandData} margin={{top:4,right:0,left:-24,bottom:0}}><CartesianGrid stroke="#f0edf7" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill:"#8d899e",fontSize:10}}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:"#aaa6b6",fontSize:9}}/><Tooltip contentStyle={{borderRadius:10,border:"1px solid #eeeaf8",fontSize:11}}/><Bar dataKey="count" name={t("الحجوزات")} fill="#a58af5" radius={[6,6,0,0]} maxBarSize={25}/></BarChart></ResponsiveContainer></div></section>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="dashboard-panel upcoming-panel"><div className="dashboard-panel-heading"><div><h2>{t("المواعيد القادمة")}</h2><p>{t("حجوزات اليوم التي لم يحن موعدها بعد")}</p></div><span className="upcoming-count">{upcoming.length}</span></div>
          {upcoming.length ? <div className="upcoming-list">{upcoming.map((row,index)=><div className="upcoming-row" key={row.id}><div className={`upcoming-avatar avatar-${index%4}`}>{row.clientName?.slice(0,1)||"؟"}</div><div className="upcoming-client"><strong>{row.clientName}</strong><span>{row.serviceName}</span></div><div className="upcoming-time"><Clock3 size={14}/>{timeLabel(row.startMinutes)}</div><span className={`upcoming-status status-${row.status}`}>{row.status==="confirmed"?t("مؤكد"):row.status==="arrived"?t("حضر"):row.status==="completed"?t("مكتمل"):row.status==="no_show"?t("لم يحضر"):t("جديد")}</span></div>)}</div> : <div className="dashboard-chart-empty">{t("لا توجد مواعيد قادمة اليوم.")}</div>}
        </section>
        <section className="dashboard-promo"><div className="promo-glow"/><span className="promo-tag"><Sparkles size={14}/> Clientora</span><h2>{t("إدارة أذكى.")}<br/>{t("تجربة أجمل.")}</h2><p>{t("كل حجوزاتك وفريقك وعملاؤك في مكان واحد.")}</p><div className="promo-stats"><span><b>{rows.filter(row=>row.status!=="cancelled").length}</b> {t("حجوزات هذا الأسبوع")}</span><span><b>{new Set(rows.map(row=>row.clientPhone||row.clientName)).size}</b> {t("عملاء")}</span></div></section>
      </div>
    </>}
  </div>;
}
