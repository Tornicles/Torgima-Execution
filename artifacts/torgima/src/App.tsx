import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/Layout";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Onboarding from "@/pages/onboarding";
import BlueprintPage from "@/pages/blueprint";
import TaskPage from "@/pages/task";
import FeedbackPage from "@/pages/feedback";
import SignalsPage from "@/pages/signals";
import IdentityPage from "@/pages/identity";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/blueprint/:id" component={BlueprintPage} />
        <Route path="/task/:id" component={TaskPage} />
        <Route path="/feedback" component={FeedbackPage} />
        <Route path="/signals" component={SignalsPage} />
        <Route path="/identity" component={IdentityPage} />
        <Route path="/settings" component={SettingsPage} />
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
