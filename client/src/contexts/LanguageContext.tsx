import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AppLanguage = "ar" | "en" | "ru";
const dictionaries: Record<Exclude<AppLanguage, "ar">, Record<string, string>> = {
  en: {
    "منصة إدارة الحجوزات":"Booking management platform","مساحة تشغيل آمنة":"Secure workspace",
    "إنشاء حساب جديد":"Create a new account","استعادة كلمة المرور":"Reset password","تعيين كلمة مرور جديدة":"Set a new password","تسجيل الدخول إلى Clientora":"Sign in to Clientora",
    "ادخل إلى لوحة الحجوزات الخاصة بك.":"Sign in to access your booking dashboard.","أدخل كود الدعوة الذي أرسله لك صاحب الشركة للانضمام إلى فريقه.":"Enter the invitation code from your company owner to join the team.","أنشئ حساب صاحب الشركة وابدأ إعداد مساحة عملك.":"Create an owner account and set up your workspace.","سنرسل رابطاً آمناً إلى بريدك الإلكتروني.":"We'll send a secure link to your email.","اكتب كلمة مرور جديدة لحسابك.":"Choose a new password for your account.",
    "الاسم الكامل":"Full name","نوع الحساب":"Account type","صاحب شركة":"Business owner","موظف":"Employee","كود دعوة الشركة":"Company invitation code","البريد الإلكتروني":"Email address","كلمة المرور (8 أحرف على الأقل)":"Password (at least 8 characters)","جارٍ المعالجة...":"Processing...","دخول إلى المنصة":"Sign in","إنشاء الحساب":"Create account","إرسال رابط الاستعادة":"Send reset link","حفظ كلمة المرور":"Save password","نسيت كلمة المرور؟":"Forgot password?","ليس لديك حساب؟":"Don't have an account?","إنشاء حساب":"Create account","لديك حساب؟":"Already have an account?","تسجيل الدخول":"Sign in","العودة للدخول":"Back to sign in","جلسة مشفرة وبيانات كل شركة معزولة":"Encrypted session · each company’s data is isolated",
    "لوحة التحكم":"Dashboard","الجدول والحجوزات":"Schedule & bookings","العملاء":"Clients","الخدمات":"Services","الموظفون":"Staff","المالية":"Finance","التقارير":"Reports","مساحة العمل":"Workspace","مساحة الشركة":"Company workspace","حجز جديد":"New booking","اليوم":"Today","الوقت":"Time","ابحث باسم العميل أو الهاتف أو الخدمة":"Search client, phone, or service","كل الحالات":"All statuses","جديد":"New","مؤكد":"Confirmed","حضر":"Arrived","مكتمل":"Completed","ملغي":"Cancelled","يوم":"Day","أسبوع":"Week","رابط الحجز":"Booking link","لا توجد حجوزات":"No bookings","تسجيل الخروج":"Sign out","لغة المنصة":"Platform language","البلد والعملة":"Country & currency","تبديل الشركة":"Switch company","إدارة الحساب":"Account management","إعدادات مساحة العمل":"Workspace settings","إدارة مركزية":"Central management","إضافة جديد":"Add new","دعوة":"Invite","ساعات العمل":"Working hours",
    "أهلاً بك 👋":"Welcome 👋","حجوزات اليوم":"Today's bookings","العملاء اليوم":"Today's clients","الإيراد المحصّل":"Collected revenue","عدم الحضور":"No-shows","نظرة على الحجوزات":"Booking overview","الحجوزات خلال الأيام السبعة القادمة":"Bookings over the next seven days","جارٍ تحميل بيانات لوحة التحكم...":"Loading dashboard data...","تعذر تحميل بيانات لوحة التحكم. حاول تحديث الصفحة.":"Could not load dashboard data. Please refresh."
  },
  ru: {
    "منصة إدارة الحجوزات":"Платформа управления бронированием","مساحة تشغيل آمنة":"Защищённое рабочее пространство",
    "إنشاء حساب جديد":"Создать аккаунт","استعادة كلمة المرور":"Восстановить пароль","تعيين كلمة مرور جديدة":"Установить новый пароль","تسجيل الدخول إلى Clientora":"Войти в Clientora",
    "ادخل إلى لوحة الحجوزات الخاصة بك.":"Войдите в панель управления бронированиями.","أدخل كود الدعوة الذي أرسله لك صاحب الشركة للانضمام إلى فريقه.":"Введите код приглашения от владельца компании, чтобы присоединиться к команде.","أنشئ حساب صاحب الشركة وابدأ إعداد مساحة عملك.":"Создайте аккаунт владельца и настройте рабочее пространство.","سنرسل رابطاً آمناً إلى بريدك الإلكتروني.":"Мы отправим безопасную ссылку на вашу почту.","اكتب كلمة مرور جديدة لحسابك.":"Укажите новый пароль для аккаунта.",
    "الاسم الكامل":"Полное имя","نوع الحساب":"Тип аккаунта","صاحب شركة":"Владелец компании","موظف":"Сотрудник","كود دعوة الشركة":"Код приглашения компании","البريد الإلكتروني":"Электронная почта","كلمة المرور (8 أحرف على الأقل)":"Пароль (не менее 8 символов)","جارٍ المعالجة...":"Обработка...","دخول إلى المنصة":"Войти","إنشاء الحساب":"Создать аккаунт","إرسال رابط الاستعادة":"Отправить ссылку","حفظ كلمة المرور":"Сохранить пароль","نسيت كلمة المرور؟":"Забыли пароль?","ليس لديك حساب؟":"Нет аккаунта?","إنشاء حساب":"Создать аккаунт","لديك حساب؟":"Уже есть аккаунт?","تسجيل الدخول":"Войти","العودة للدخول":"Вернуться ко входу","جلسة مشفرة وبيانات كل شركة معزولة":"Защищённая сессия · данные компаний изолированы",
    "لوحة التحكم":"Панель управления","الجدول والحجوزات":"Расписание и бронирования","العملاء":"Клиенты","الخدمات":"Услуги","الموظفون":"Сотрудники","المالية":"Финансы","التقارير":"Отчёты","مساحة العمل":"Рабочее пространство","مساحة الشركة":"Рабочее пространство компании","حجز جديد":"Новое бронирование","اليوم":"Сегодня","الوقت":"Время","ابحث باسم العميل أو الهاتف أو الخدمة":"Поиск по клиенту, телефону или услуге","كل الحالات":"Все статусы","جديد":"Новый","مؤكد":"Подтверждено","حضر":"Пришёл","مكتمل":"Завершено","ملغي":"Отменено","يوم":"День","أسبوع":"Неделя","رابط الحجز":"Ссылка для бронирования","لا توجد حجوزات":"Нет бронирований","تسجيل الخروج":"Выйти","لغة المنصة":"Язык платформы","البلد والعملة":"Страна и валюта","تبديل الشركة":"Сменить компанию","إدارة الحساب":"Управление аккаунтом","إعدادات مساحة العمل":"Настройки пространства","إدارة مركزية":"Центральное управление","إضافة جديد":"Добавить","دعوة":"Пригласить","ساعات العمل":"Рабочие часы",
    "أهلاً بك 👋":"Добро пожаловать 👋","حجوزات اليوم":"Бронирования сегодня","العملاء اليوم":"Клиенты сегодня","الإيراد المحصّل":"Полученная выручка","عدم الحضور":"Неявки","نظرة على الحجوزات":"Обзор бронирований","الحجوزات خلال الأيام السبعة القادمة":"Бронирования на ближайшие семь дней","جارٍ تحميل بيانات لوحة التحكم...":"Загрузка панели управления...","تعذر تحميل بيانات لوحة التحكم. حاول تحديث الصفحة.":"Не удалось загрузить данные. Обновите страницу."
  }
};
type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: (arabicText: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return "ar";
    const saved = window.localStorage.getItem("clientora-language");
    return saved === "en" || saved === "ru" ? saved : "ar";
  });
  useEffect(() => {
    window.localStorage.setItem("clientora-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  const t = (arabicText: string) => language === "ar" ? arabicText : dictionaries[language][arabicText] ?? arabicText;
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}
