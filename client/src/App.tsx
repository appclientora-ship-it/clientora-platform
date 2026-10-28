import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import OnlineBooking from "./pages/OnlineBooking";
import AuthPage from "./pages/AuthPage";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";

function ProtectedHome() { const auth = trpc.auth.me.useQuery(); if (auth.isLoading) return <div className="auth-loading">جارٍ التحقق من الجلسة...</div>; return auth.data ? <Home /> : <Redirect to="/login" />; }

function Router() {
  return <Switch><Route path="/" component={ProtectedHome} /><Route path="/login"><AuthPage mode="login" /></Route><Route path="/register"><AuthPage mode="register" /></Route><Route path="/forgot-password"><AuthPage mode="forgot" /></Route><Route path="/reset-password"><AuthPage mode="reset" /></Route><Route path="/book/:slug" component={OnlineBooking} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}
export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster/><Router/></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
