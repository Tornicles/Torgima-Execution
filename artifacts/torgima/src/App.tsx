import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/Layout";
import { API_BASE_URL } from "@/lib/api-base";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import VerifyPage from "@/pages/verify";
import Dashboard from "@/pages/dashboard";
import Onboarding from "@/pages/onboarding";
import BlueprintPage from "@/pages/blueprint";
import TaskPage from "@/pages/task";
import FeedbackPage from "@/pages/feedback";
import SignalsPage from "@/pages/signals";
import IdentityPage from "@/pages/identity";
import CapabilityPage from "@/pages/capability";
import AcademyPage from "@/pages/academy";
import SettingsPage from "@/pages/settings";
import UnsubscribePage from "@/pages/unsubscribe";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/session`, { credentials: "include" })
      .then((r) => r.json())
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
      <div style={{ color: "white", padding: "2rem" }} className="bg-background font-mono text-sm">
        Loading…
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
const ProtectedIdentityPage = protect(IdentityPage);
const ProtectedCapabilityPage = protect(CapabilityPage);
const ProtectedAcademyPage = protect(AcademyPage);
const ProtectedSettingsPage = protect(SettingsPage);
const ProtectedBlueprintPage = protect(BlueprintPage);

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

const OnboardingRoute = withAppLayout(ProtectedOnboarding);
const DashboardRoute = withAppLayout(ProtectedDashboard);
const TaskRoute = withAppLayout(ProtectedTaskPage);
const FeedbackRoute = withAppLayout(ProtectedFeedbackPage);
const SignalsRoute = withAppLayout(ProtectedSignalsPage);
const IdentityRoute = withAppLayout(ProtectedIdentityPage);
const CapabilityRoute = withAppLayout(ProtectedCapabilityPage);
const AcademyRoute = withAppLayout(ProtectedAcademyPage);
const SettingsRoute = withAppLayout(ProtectedSettingsPage);
const BlueprintRoute = withAppLayout(ProtectedBlueprintPage);

function Router() {
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
      <Route path="/identity" component={IdentityRoute} />
      <Route path="/capability" component={CapabilityRoute} />
      <Route path="/academy" component={AcademyRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/blueprint/:id" component={BlueprintRoute} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="torgima-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
