import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/Layout";
import { API_BASE_URL } from "@/lib/api-base";
import { setBaseUrl } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import VerifyPage from "@/pages/verify";
import Dashboard from "@/pages/dashboard";
import Onboarding from "@/pages/onboarding";
import BlueprintPage from "@/pages/blueprint";
import BlueprintIndexPage from "@/pages/blueprint-index";
import TaskPage from "@/pages/task";
import FeedbackPage from "@/pages/feedback";
import SignalsPage from "@/pages/signals";
import SettingsPage from "@/pages/settings";
import UnsubscribePage from "@/pages/unsubscribe";
import OrdersPage from "@/pages/orders";
import StrategyPage from "@/pages/strategy";
import RecoveryPage from "@/pages/recovery";
import CharacterPage from "@/pages/character";
import KnowledgePage from "@/pages/knowledge";
import IntelligencePage from "@/pages/intelligence";

setBaseUrl(API_BASE_URL || null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!API_BASE_URL) {
      setChecking(false);
      setLocation("/login");
      return;
    }
    fetch(`${API_BASE_URL}/api/auth/session`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data: { ok?: boolean; data?: { authenticated?: boolean } }) => {
        if (data?.ok && data?.data?.authenticated) {
          setAuthenticated(true);
        } else {
          setLocation("/login");
        }
      })
      .catch(() => setLocation("/login"))
      .finally(() => setChecking(false));
  }, [setLocation]);

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return null;
  return <>{children}</>;
}

function protect(Page: ComponentType) {
  const Wrapped = () => (
    <ProtectedRoute>
      <Page />
    </ProtectedRoute>
  );
  Wrapped.displayName = `Protected(${Page.displayName ?? Page.name ?? "Page"})`;
  return Wrapped;
}

const ProtectedOnboarding = protect(Onboarding);
const ProtectedDashboard = protect(Dashboard);
const ProtectedTaskPage = protect(TaskPage);
const ProtectedFeedbackPage = protect(FeedbackPage);
const ProtectedSignalsPage = protect(SignalsPage);
const ProtectedSettingsPage = protect(SettingsPage);
const ProtectedBlueprintPage = protect(BlueprintPage);
const ProtectedBlueprintIndex = protect(BlueprintIndexPage);
const ProtectedOrdersPage = protect(OrdersPage);
const ProtectedStrategyPage = protect(StrategyPage);
const ProtectedRecoveryPage = protect(RecoveryPage);
const ProtectedCharacterPage = protect(CharacterPage);
const ProtectedKnowledgePage = protect(KnowledgePage);
const ProtectedIntelligencePage = protect(IntelligencePage);

function withAppLayout(Page: ComponentType) {
  function Wrapped() {
    return (
      <Layout>
        <Page />
      </Layout>
    );
  }
  Wrapped.displayName = `WithAppLayout(${Page.displayName ?? Page.name ?? "Page"})`;
  return Wrapped;
}

/** Onboarding is a full-page flow (no app sidebar). */
const OnboardingRoute = ProtectedOnboarding;
const DashboardRoute = withAppLayout(ProtectedDashboard);
const TaskRoute = withAppLayout(ProtectedTaskPage);
const FeedbackRoute = withAppLayout(ProtectedFeedbackPage);
const SignalsRoute = withAppLayout(ProtectedSignalsPage);
const SettingsRoute = withAppLayout(ProtectedSettingsPage);
const BlueprintRoute = withAppLayout(ProtectedBlueprintPage);
const BlueprintIndexRoute = withAppLayout(ProtectedBlueprintIndex);
const OrdersRoute = withAppLayout(ProtectedOrdersPage);
const StrategyRoute = withAppLayout(ProtectedStrategyPage);
const RecoveryRoute = withAppLayout(ProtectedRecoveryPage);
const CharacterRoute = withAppLayout(ProtectedCharacterPage);
const KnowledgeRoute = withAppLayout(ProtectedKnowledgePage);
const IntelligenceRoute = withAppLayout(ProtectedIntelligencePage);

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/verify" component={VerifyPage} />
      <Route path="/notifications/unsubscribe" component={UnsubscribePage} />

      <Route path="/onboarding" component={OnboardingRoute} />
      <Route path="/dashboard" component={DashboardRoute} />
      <Route path="/tasks/:orderId" component={TaskRoute} />
      <Route path="/feedback/:orderId" component={FeedbackRoute} />
      <Route path="/feedback" component={FeedbackRoute} />
      <Route path="/signals" component={SignalsRoute} />
      <Route path="/intelligence" component={IntelligenceRoute} />
      <Route path="/orders" component={OrdersRoute} />
      <Route path="/strategy" component={StrategyRoute} />
      <Route path="/recovery" component={RecoveryRoute} />
      <Route path="/character" component={CharacterRoute} />
      <Route path="/knowledge" component={KnowledgeRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/blueprint/:id" component={BlueprintRoute} />
      <Route path="/blueprint" component={BlueprintIndexRoute} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="torgima-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
