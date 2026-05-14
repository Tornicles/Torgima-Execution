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

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/verify" component={VerifyPage} />
        <Route path="/notifications/unsubscribe" component={UnsubscribePage} />

        <Route path="/onboarding" component={ProtectedOnboarding} />
        <Route path="/dashboard" component={ProtectedDashboard} />
        <Route path="/tasks/:orderId" component={ProtectedTaskPage} />
        <Route path="/feedback/:orderId" component={ProtectedFeedbackPage} />
        <Route path="/feedback" component={ProtectedFeedbackPage} />
        <Route path="/signals" component={ProtectedSignalsPage} />
        <Route path="/identity" component={ProtectedIdentityPage} />
        <Route path="/capability" component={ProtectedCapabilityPage} />
        <Route path="/academy" component={ProtectedAcademyPage} />
        <Route path="/settings" component={ProtectedSettingsPage} />
        <Route path="/blueprint/:id" component={ProtectedBlueprintPage} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
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
