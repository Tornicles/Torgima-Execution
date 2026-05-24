import type { ComponentType, LazyExoticComponent } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/Layout";
import { API_BASE_URL } from "@/lib/api-base";
import { setBaseUrl } from "@workspace/api-client-react";
import { getAuthSession } from "@/lib/torgima-api";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import HowItWorksPage from "@/pages/how-it-works";
import PricingPage from "@/pages/pricing";
import AboutPage from "@/pages/about";
import ChangelogPage from "@/pages/changelog";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import VerifyPage from "@/pages/verify";
import UnsubscribePage from "@/pages/unsubscribe";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const ValidatePage = lazy(() => import("@/pages/validate"));
const ValidationResultsPage = lazy(() => import("@/pages/validation-results"));
const ValidationScoresPage = lazy(() => import("@/pages/validation-scores"));
const ValidationRunningPage = lazy(() => import("@/pages/validation-running"));
const BlueprintPage = lazy(() => import("@/pages/blueprint"));
const BlueprintIndexPage = lazy(() => import("@/pages/blueprint-index"));
const TaskPage = lazy(() => import("@/pages/task"));
const FeedbackPage = lazy(() => import("@/pages/feedback"));
const SignalsPage = lazy(() => import("@/pages/signals"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const SettingsSkillsPage = lazy(() => import("@/pages/settings-skills"));
const OrdersPage = lazy(() => import("@/pages/orders"));
const StrategyPage = lazy(() => import("@/pages/strategy"));
const RecoveryPage = lazy(() => import("@/pages/recovery"));
const CharacterPage = lazy(() => import("@/pages/character"));
const KnowledgePage = lazy(() => import("@/pages/knowledge"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const AcademyLearnPage = lazy(() => import("@/pages/academy"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const ChatPage = lazy(() => import("@/pages/chat"));
const GamificationPage = lazy(() => import("@/pages/gamification"));
const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const IntegrationsPage = lazy(() => import("@/pages/integrations"));
const PublicProfilePage = lazy(() => import("@/pages/public-profile"));
const PrincipleEntryPage = lazy(() => import("@/pages/principle-entry"));
const ProfileSettingsPage = lazy(() => import("@/pages/profile-settings"));
const ProfileWidgetPage = lazy(() => import("@/pages/profile-widget"));
const ProfileDayPage = lazy(() => import("@/pages/profile-day"));
const IntelligencePage = lazy(() => import("@/pages/intelligence"));

setBaseUrl(API_BASE_URL);

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
    void getAuthSession()
      .then((data) => {
        if ((data as { authenticated?: boolean })?.authenticated) {
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

type RoutePage = ComponentType | LazyExoticComponent<ComponentType>;

function displayNameFor(Page: RoutePage) {
  const named = Page as RoutePage & { displayName?: string; name?: string };
  return named.displayName ?? named.name ?? "Page";
}

function RouteLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

function protect(Page: RoutePage) {
  const Wrapped = () => (
    <ProtectedRoute>
      <Page />
    </ProtectedRoute>
  );
  Wrapped.displayName = `Protected(${displayNameFor(Page)})`;
  return Wrapped;
}

const ProtectedOnboarding = protect(Onboarding);
const ProtectedValidate = protect(ValidatePage);
const ProtectedValidationResults = protect(ValidationResultsPage);
const ProtectedValidationScores = protect(ValidationScoresPage);
const ProtectedValidationRunning = protect(ValidationRunningPage);
const ProtectedDashboard = protect(Dashboard);
const ProtectedTaskPage = protect(TaskPage);
const ProtectedFeedbackPage = protect(FeedbackPage);
const ProtectedSignalsPage = protect(SignalsPage);
const ProtectedSettingsPage = protect(SettingsPage);
const ProtectedSettingsSkillsPage = protect(SettingsSkillsPage);
const ProtectedBlueprintPage = protect(BlueprintPage);
const ProtectedBlueprintIndex = protect(BlueprintIndexPage);
const ProtectedOrdersPage = protect(OrdersPage);
const ProtectedStrategyPage = protect(StrategyPage);
const ProtectedRecoveryPage = protect(RecoveryPage);
const ProtectedCharacterPage = protect(CharacterPage);
const ProtectedKnowledgePage = protect(KnowledgePage);
const ProtectedReportsPage = protect(ReportsPage);
const ProtectedAcademyLearnPage = protect(AcademyLearnPage);
const ProtectedCalendarPage = protect(CalendarPage);
const ProtectedChatPage = protect(ChatPage);
const ProtectedGamificationPage = protect(GamificationPage);
const ProtectedAnalyticsPage = protect(AnalyticsPage);
const ProtectedIntegrationsPage = protect(IntegrationsPage);
const ProtectedProfileSettingsPage = protect(ProfileSettingsPage);
const ProtectedIntelligencePage = protect(IntelligencePage);

function withAppLayout(Page: ComponentType) {
  function Wrapped() {
    return (
      <Layout>
        <Page />
      </Layout>
    );
  }
  Wrapped.displayName = `WithAppLayout(${displayNameFor(Page)})`;
  return Wrapped;
}

/** Pre-launch flows — no app sidebar. */
const OnboardingRoute = ProtectedOnboarding;
const ValidateRoute = ProtectedValidate;
const ValidationResultsRoute = ProtectedValidationResults;
const ValidationScoresRoute = ProtectedValidationScores;
const DashboardRoute = withAppLayout(ProtectedDashboard);
const TaskRoute = withAppLayout(ProtectedTaskPage);
const FeedbackRoute = withAppLayout(ProtectedFeedbackPage);
const SignalsRoute = withAppLayout(ProtectedSignalsPage);
const SettingsRoute = withAppLayout(ProtectedSettingsPage);
const SettingsSkillsRoute = withAppLayout(ProtectedSettingsSkillsPage);
const BlueprintRoute = withAppLayout(ProtectedBlueprintPage);
const BlueprintIndexRoute = withAppLayout(ProtectedBlueprintIndex);
const OrdersRoute = withAppLayout(ProtectedOrdersPage);
const StrategyRoute = withAppLayout(ProtectedStrategyPage);
const RecoveryRoute = withAppLayout(ProtectedRecoveryPage);
const CharacterRoute = withAppLayout(ProtectedCharacterPage);
const KnowledgeRoute = withAppLayout(ProtectedKnowledgePage);
const ReportsRoute = withAppLayout(ProtectedReportsPage);
const AcademyLearnRoute = withAppLayout(ProtectedAcademyLearnPage);
const CalendarRoute = withAppLayout(ProtectedCalendarPage);
const ChatRoute = withAppLayout(ProtectedChatPage);
const GamificationRoute = withAppLayout(ProtectedGamificationPage);
const AnalyticsRoute = withAppLayout(ProtectedAnalyticsPage);
const IntegrationsRoute = withAppLayout(ProtectedIntegrationsPage);
const ProfileSettingsRoute = withAppLayout(ProtectedProfileSettingsPage);
const IntelligenceRoute = withAppLayout(ProtectedIntelligencePage);

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/how-it-works" component={HowItWorksPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/changelog" component={ChangelogPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/verify" component={VerifyPage} />
        <Route path="/notifications/unsubscribe" component={UnsubscribePage} />

        <Route path="/validate" component={ValidateRoute} />
        <Route path="/validation/:id/results" component={ValidationResultsRoute} />
        <Route path="/onboarding/goal" component={ValidateRoute} />
        <Route path="/onboarding" component={OnboardingRoute} />
        <Route path="/validation/:id/running" component={ProtectedValidationRunning} />
        <Route path="/validation/scores" component={ValidationScoresRoute} />
        <Route path="/validation" component={ValidationScoresRoute} />
        <Route path="/dashboard" component={DashboardRoute} />
        <Route path="/tasks/:orderId" component={TaskRoute} />
        <Route path="/execute" component={TaskRoute} />
        <Route path="/execute/:orderId" component={TaskRoute} />
        <Route path="/feedback/:orderId" component={FeedbackRoute} />
        <Route path="/feedback" component={FeedbackRoute} />
        <Route path="/signals" component={SignalsRoute} />
        <Route path="/intelligence" component={IntelligenceRoute} />
        <Route path="/orders" component={OrdersRoute} />
        <Route path="/strategy" component={StrategyRoute} />
        <Route path="/recovery" component={RecoveryRoute} />
        <Route path="/character" component={CharacterRoute} />
        <Route path="/knowledge" component={KnowledgeRoute} />
        <Route path="/reports" component={ReportsRoute} />
        <Route path="/academy/lesson/:lessonId" component={AcademyLearnRoute} />
        <Route path="/academy/course/:courseId" component={AcademyLearnRoute} />
        <Route path="/academy/tutor" component={AcademyLearnRoute} />
        <Route path="/academy/progress" component={AcademyLearnRoute} />
        <Route path="/academy" component={AcademyLearnRoute} />
        <Route path="/calendar" component={CalendarRoute} />
        <Route path="/chat" component={ChatRoute} />
        <Route path="/progress" component={GamificationRoute} />
        <Route path="/gamification" component={GamificationRoute} />
        <Route path="/analytics" component={AnalyticsRoute} />
        <Route path="/integrations" component={IntegrationsRoute} />
        <Route path="/profiles/:username/entry/:entryDate" component={ProfileDayPage} />
        <Route path="/profiles/:username" component={PublicProfilePage} />
        <Route path="/principles/entry/:shareToken" component={PrincipleEntryPage} />
        <Route path="/widget/:widgetType/:userId" component={ProfileWidgetPage} />
        <Route path="/settings/profile" component={ProfileSettingsRoute} />
        <Route path="/settings/skills" component={SettingsSkillsRoute} />
        <Route path="/settings" component={SettingsRoute} />
        <Route path="/blueprint/:id" component={BlueprintRoute} />
        <Route path="/blueprint" component={BlueprintIndexRoute} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
