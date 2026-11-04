import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import PlatformAdmin from "./pages/PlatformAdmin";
import OnlineBooking from "./pages/OnlineBooking";
import AuthPage from "./pages/AuthPage";
import OwnerOnboarding from "./pages/OwnerOnboarding";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";

function ProtectedHome() { const auth = trpc.auth.me.useQuery(); const memberships = trpc.workspace.memberships.useQuery(undefined, { enabled: !!auth.data && auth.data.role !== "admin" }); const { t, language } = useLanguage(); if (auth.isLoading || (auth.data && auth.data.role !== "admin" && memberships.isLoading)) return <div className="auth-loading" dir={language === "ar" ? "rtl" : "ltr"}>{t("جارٍ التحقق من الجلسة...")}</div>; if (!auth.data) return <Redirect to="/login" />; if (auth.data.role === "admin") return <PlatformAdmin />; if (memberships.isError) return <div className="auth-loading">{t("تعذر تحميل مساحة العمل. أعد المحاولة.")}</div>; return (memberships.data?.length ?? 0) === 0 ? <Redirect to="/onboarding" /> : <Home />; }

function Router() {
  return <Switch><Route path="/" component={ProtectedHome} /><Route path="/login"><AuthPage mode="login" /></Route><Route path="/register"><AuthPage mode="register" /></Route><Route path="/onboarding" component={OwnerOnboarding} /><Route path="/forgot-password"><AuthPage mode="forgot" /></Route><Route path="/reset-password"><AuthPage mode="reset" /></Route><Route path="/verify-email"><AuthPage mode="verify" /></Route><Route path="/book/:slug" component={OnlineBooking} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}
export default function App() {
  return <ErrorBoundary><LanguageProvider><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster/><Router/></TooltipProvider></ThemeProvider></LanguageProvider></ErrorBoundary>;
}
