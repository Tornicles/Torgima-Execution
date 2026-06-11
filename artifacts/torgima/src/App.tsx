import type { ComponentType, LazyExoticComponent } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/Layout";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { TierFeatureGate } from "@/components/sequence/TierFeatureGate";
import { API_BASE_URL } from "@/lib/api-base";
import { setBaseUrl } from "@workspace/api-client-react";
import { UpgradeGate } from "@/components/UpgradeGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { AuthProvider } from "@/providers/AuthProvider";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import HowItWorksPage from "@/pages/how-it-works";
import PricingPage from "@/pages/pricing";
import AboutPage from "@/pages/about";
import ChangelogPage from "@/pages/changelog";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import SignupCheckEmailPage from "@/pages/signup/check-email";
import ForgotPasswordPage from "@/pages/forgot-password";
import VerifyPage from "@/pages/verify";
import AuthCallbackPage from "@/pages/auth/callback";
import UnsubscribePage from "@/pages/unsubscribe";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const OnboardingGoalPage = lazy(() => import("@/pages/onboarding/index"));
const OnboardingContextPage = lazy(() => import("@/pages/onboarding/context"));
const OnboardingStructurePage = lazy(() => import("@/pages/onboarding/structure"));
const OnboardingReviewPage = lazy(() => import("@/pages/onboarding/review"));
const OnboardingValidatingPage = lazy(() => import("@/pages/onboarding/validating"));
const OnboardingResultsRedirectPage = lazy(() => import("@/pages/onboarding/results"));
const OnboardingSelectBlueprintPage = lazy(() => import("@/pages/onboarding/select-blueprint"));
const ErectorDashboard = lazy(() => import("@/pages/erector-dashboard"));
const AcademyPage = lazy(() => import("@/pages/academy"));
const ValidatePage = lazy(() => import("@/pages/validate"));
const ValidationResultsPage = lazy(() => import("@/pages/validation-results"));
const ValidationBlueprintPage = lazy(() => import("@/pages/validation-blueprint"));
const ValidationScoresPage = lazy(() => import("@/pages/validation-scores"));
const ValidationRunningPage = lazy(() => import("@/pages/validation-running"));
const UpgradePage = lazy(() => import("@/pages/upgrade"));
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
const GrowthPage = lazy(() => import("@/pages/growth"));
const GrowthKnowledgePage = lazy(() => import("@/pages/growth-knowledge"));
const GrowthInterrogationPage = lazy(() => import("@/pages/growth-interrogation"));
const GrowthAdaptationPage = lazy(() => import("@/pages/growth-adaptation"));
const GrowthPatternsPage = lazy(() => import("@/pages/growth-patterns"));
const UltimatePage = lazy(() => import("@/pages/ultimate"));
const UltimatePredictionsPage = lazy(() => import("@/pages/ultimate-predictions"));
const UltimateScenePage = lazy(() => import("@/pages/ultimate-scene"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const BhudhiPage = lazy(() => import("@/pages/bhudhi"));
const GovernanceConsolePage = lazy(() => import("@/pages/governance-console"));
const BhudhiEconomicsPage = lazy(() => import("@/pages/bhudhi-economics"));
const BhudhiDecisionPage = lazy(() => import("@/pages/bhudhi-decision"));
const BhudhiBeliefsPage = lazy(() => import("@/pages/bhudhi-beliefs"));
const BhudhiWorldPage = lazy(() => import("@/pages/bhudhi-world"));
const BhudhiIdentityPage = lazy(() => import("@/pages/bhudhi-identity"));
const BhudhiOrganizationPage = lazy(() => import("@/pages/bhudhi-organization"));
const BhudhiExperimentsPage = lazy(() => import("@/pages/bhudhi-experiments"));
const BhudhiTemporalPage = lazy(() => import("@/pages/bhudhi-temporal"));
const BhudhiMetaGovernorPage = lazy(() => import("@/pages/bhudhi-governor"));
const BhudhiReliabilityPage = lazy(() => import("@/pages/bhudhi-reliability"));
const BhudhiSecurityPage = lazy(() => import("@/pages/bhudhi-security"));
const BhudhiInfrastructurePage = lazy(() => import("@/pages/bhudhi-infrastructure"));
const BhudhiTeamsPage = lazy(() => import("@/pages/bhudhi-teams"));
const BhudhiErectorPage = lazy(() => import("@/pages/bhudhi-erector"));
const BhudhiCivilizationPage = lazy(() => import("@/pages/bhudhi-civilization"));
const BhudhiExpansionPage = lazy(() => import("@/pages/bhudhi-expansion"));
const BhudhiKernelPage = lazy(() => import("@/pages/bhudhi-kernel"));
const BhudhiMemoryPage = lazy(() => import("@/pages/bhudhi-memory"));
const BhudhiProtocolPage = lazy(() => import("@/pages/bhudhi-protocol"));
const BhudhiUniversalPage = lazy(() => import("@/pages/bhudhi-universal"));
const BhudhiLaunchOnboardingPage = lazy(() => import("@/pages/bhudhi-launch-onboarding"));
const TorgimaBhudhiPage = lazy(() => import("@/pages/torgima-bhudhi"));
const PublicProfilePage = lazy(() => import("@/pages/public-profile"));
const PrincipleEntryPage = lazy(() => import("@/pages/principle-entry"));
const ProfileSettingsPage = lazy(() => import("@/pages/profile-settings"));
const AdminApp = lazy(() => import("@/admin/AdminApp"));
const ProfileWidgetPage = lazy(() => import("@/pages/profile-widget"));
const ProfileDayPage = lazy(() => import("@/pages/profile-day"));

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
  const { loaded, authenticated } = useSessionGuard();

  if (!loaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Redirect to="/login" />;
  }
  return <ErrorBoundary>{children}</ErrorBoundary>;
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

function withTierFeatureGate(required: "growth" | "ultimate", Page: RoutePage): RoutePage {
  const Gated = () => (
    <TierFeatureGate required={required}>
      <Page />
    </TierFeatureGate>
  );
  Gated.displayName = `TierGated(${displayNameFor(Page)})`;
  return Gated;
}

const ProtectedOnboardingGoal = protect(OnboardingGoalPage);
const ProtectedOnboardingContext = protect(OnboardingContextPage);
const ProtectedOnboardingStructure = protect(OnboardingStructurePage);
const ProtectedOnboardingReview = protect(OnboardingReviewPage);
const ProtectedOnboardingValidating = protect(OnboardingValidatingPage);
const ProtectedOnboardingResults = protect(OnboardingResultsRedirectPage);
const ProtectedOnboardingSelectBlueprint = protect(OnboardingSelectBlueprintPage);
const ProtectedErectorDashboard = protect(ErectorDashboard);
const ProtectedAcademyPage = protect(AcademyPage);
const ProtectedValidate = protect(ValidatePage);
const ProtectedValidationResults = protect(ValidationResultsPage);
const ProtectedValidationBlueprint = protect(ValidationBlueprintPage);
const ProtectedValidationScores = protect(ValidationScoresPage);
const ProtectedValidationRunning = protect(ValidationRunningPage);
const ProtectedUpgrade = protect(UpgradePage);
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
const ProtectedGrowthPage = protect(withTierFeatureGate("growth", GrowthPage));
const ProtectedGrowthKnowledgePage = protect(withTierFeatureGate("growth", GrowthKnowledgePage));
const ProtectedGrowthInterrogationPage = protect(
  withTierFeatureGate("growth", GrowthInterrogationPage),
);
const ProtectedGrowthAdaptationPage = protect(withTierFeatureGate("growth", GrowthAdaptationPage));
const ProtectedGrowthPatternsPage = protect(withTierFeatureGate("growth", GrowthPatternsPage));
const ProtectedUltimatePage = protect(withTierFeatureGate("ultimate", UltimatePage));
const ProtectedUltimatePredictionsPage = protect(
  withTierFeatureGate("ultimate", UltimatePredictionsPage),
);
const ProtectedUltimateScenePage = protect(withTierFeatureGate("ultimate", UltimateScenePage));
const ProtectedReportsPage = protect(ReportsPage);
const ProtectedBhudhiPage = protect(BhudhiPage);
const ProtectedProfileSettingsPage = protect(ProfileSettingsPage);

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

function withOnboardingLayout(Page: ComponentType) {
  function Wrapped() {
    return (
      <OnboardingLayout>
        <Page />
      </OnboardingLayout>
    );
  }
  Wrapped.displayName = `WithOnboardingLayout(${displayNameFor(Page)})`;
  return Wrapped;
}

/** Pre-launch flows — no app sidebar. */
const OnboardingRoute = withOnboardingLayout(ProtectedOnboardingGoal);
const OnboardingContextRoute = withOnboardingLayout(ProtectedOnboardingContext);
const OnboardingStructureRoute = withOnboardingLayout(ProtectedOnboardingStructure);
const OnboardingReviewRoute = withOnboardingLayout(ProtectedOnboardingReview);
const OnboardingValidatingRoute = withOnboardingLayout(ProtectedOnboardingValidating);
const OnboardingResultsRoute = withOnboardingLayout(ProtectedOnboardingResults);
const OnboardingSelectBlueprintRoute = withOnboardingLayout(ProtectedOnboardingSelectBlueprint);
const ValidateRoute = withOnboardingLayout(ProtectedValidate);
const ValidationResultsRoute = withOnboardingLayout(ProtectedValidationResults);
const ValidationBlueprintRoute = ProtectedValidationBlueprint;
const ValidationScoresRoute = ProtectedValidationScores;
const UpgradeRoute = ProtectedUpgrade;
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
const GrowthRoute = withAppLayout(ProtectedGrowthPage);
const GrowthKnowledgeRoute = withAppLayout(ProtectedGrowthKnowledgePage);
const GrowthInterrogationRoute = withAppLayout(ProtectedGrowthInterrogationPage);
const GrowthAdaptationRoute = withAppLayout(ProtectedGrowthAdaptationPage);
const GrowthPatternsRoute = withAppLayout(ProtectedGrowthPatternsPage);
const UltimateRoute = withAppLayout(ProtectedUltimatePage);
const UltimatePredictionsRoute = withAppLayout(ProtectedUltimatePredictionsPage);
const UltimateSceneRoute = withAppLayout(ProtectedUltimateScenePage);
const ReportsRoute = withAppLayout(ProtectedReportsPage);
const ErectorRoute = withAppLayout(ProtectedErectorDashboard);
const AcademyRoute = withAppLayout(ProtectedAcademyPage);
const BhudhiRoute = withAppLayout(ProtectedBhudhiPage);
const BhudhiEconomicsRoute = withAppLayout(protect(BhudhiEconomicsPage));
const BhudhiDecisionRoute = withAppLayout(protect(BhudhiDecisionPage));
const BhudhiBeliefsRoute = withAppLayout(protect(BhudhiBeliefsPage));
const BhudhiWorldRoute = withAppLayout(protect(BhudhiWorldPage));
const BhudhiIdentityRoute = withAppLayout(protect(BhudhiIdentityPage));
const BhudhiOrganizationRoute = withAppLayout(protect(BhudhiOrganizationPage));
const BhudhiExperimentsRoute = withAppLayout(protect(BhudhiExperimentsPage));
const BhudhiTemporalRoute = withAppLayout(protect(BhudhiTemporalPage));
const BhudhiMetaGovernorRoute = withAppLayout(protect(BhudhiMetaGovernorPage));
const BhudhiReliabilityRoute = withAppLayout(protect(BhudhiReliabilityPage));
const BhudhiSecurityRoute = withAppLayout(protect(BhudhiSecurityPage));
const BhudhiInfrastructureRoute = withAppLayout(protect(BhudhiInfrastructurePage));
const BhudhiTeamsRoute = withAppLayout(protect(BhudhiTeamsPage));
const BhudhiErectorRoute = withAppLayout(protect(BhudhiErectorPage));
const BhudhiCivilizationRoute = withAppLayout(protect(BhudhiCivilizationPage));
const BhudhiExpansionRoute = withAppLayout(protect(BhudhiExpansionPage));
const BhudhiKernelRoute = withAppLayout(protect(BhudhiKernelPage));
const BhudhiMemoryRoute = withAppLayout(protect(BhudhiMemoryPage));
const BhudhiProtocolRoute = withAppLayout(protect(BhudhiProtocolPage));
const BhudhiUniversalRoute = withAppLayout(protect(BhudhiUniversalPage));
const BhudhiLaunchOnboardingRoute = withAppLayout(protect(BhudhiLaunchOnboardingPage));
const TorgimaBhudhiRoute = withAppLayout(protect(TorgimaBhudhiPage));
const GovernanceConsoleRoute = withAppLayout(protect(GovernanceConsolePage));
const ProfileSettingsRoute = withAppLayout(ProtectedProfileSettingsPage);

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/admin/login" component={AdminApp} />
        <Route path="/admin/dashboard" component={AdminApp} />
        <Route path="/admin/users/:userId" component={AdminApp} />
        <Route path="/admin/users" component={AdminApp} />
        <Route path="/admin/health" component={AdminApp} />
        <Route path="/admin/analytics" component={AdminApp} />
        <Route path="/admin/bhudhi" component={AdminApp} />
        <Route path="/admin/dead-letter" component={AdminApp} />
        <Route path="/admin/audit" component={AdminApp} />
        <Route path="/admin" component={AdminApp} />

        <Route path="/" component={LandingPage} />
        <Route path="/how-it-works" component={HowItWorksPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/changelog" component={ChangelogPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/signup/check-email" component={SignupCheckEmailPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/auth/callback" component={AuthCallbackPage} />
        <Route path="/verify" component={VerifyPage} />
        <Route path="/notifications/unsubscribe" component={UnsubscribePage} />

        <Route path="/upgrade" component={UpgradeRoute} />
        <Route path="/validate" component={ValidateRoute} />
        <Route path="/validation/:id/results" component={ValidationResultsRoute} />
        <Route path="/validation/:id/blueprint" component={ValidationBlueprintRoute} />
        <Route path="/onboarding" component={OnboardingRoute} />
        <Route path="/onboarding/context" component={OnboardingContextRoute} />
        <Route path="/onboarding/structure" component={OnboardingStructureRoute} />
        <Route path="/onboarding/review" component={OnboardingReviewRoute} />
        <Route path="/onboarding/validating" component={OnboardingValidatingRoute} />
        <Route path="/onboarding/results" component={OnboardingResultsRoute} />
        <Route path="/onboarding/select-blueprint" component={OnboardingSelectBlueprintRoute} />
        <Route path="/onboarding/goal" component={OnboardingRoute} />
        <Route path="/erector" component={ErectorRoute} />
        <Route path="/academy" component={AcademyRoute} />
        <Route path="/academy/course/:courseId" component={AcademyRoute} />
        <Route path="/academy/lesson/:lessonId" component={AcademyRoute} />
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
        <Route path="/orders" component={OrdersRoute} />
        <Route path="/strategy" component={StrategyRoute} />
        <Route path="/recovery" component={RecoveryRoute} />
        <Route path="/character" component={CharacterRoute} />
        <Route path="/knowledge" component={KnowledgeRoute} />
        <Route path="/growth" component={GrowthRoute} />
        <Route path="/growth/knowledge" component={GrowthKnowledgeRoute} />
        <Route path="/growth/interrogation" component={GrowthInterrogationRoute} />
        <Route path="/growth/adaptation" component={GrowthAdaptationRoute} />
        <Route path="/growth/patterns" component={GrowthPatternsRoute} />
        <Route path="/ultimate" component={UltimateRoute} />
        <Route path="/ultimate/predictions" component={UltimatePredictionsRoute} />
        <Route path="/ultimate/scene" component={UltimateSceneRoute} />
        <Route path="/reports" component={ReportsRoute} />
        <Route path="/bhudhi" component={BhudhiRoute} />
        <Route path="/console/governance" component={GovernanceConsoleRoute} />
        <Route path="/bhudhi/economics" component={BhudhiEconomicsRoute} />
        <Route path="/app/bhudhi/economics" component={BhudhiEconomicsRoute} />
        <Route path="/bhudhi/decision" component={BhudhiDecisionRoute} />
        <Route path="/app/bhudhi/decision" component={BhudhiDecisionRoute} />
        <Route path="/bhudhi/beliefs" component={BhudhiBeliefsRoute} />
        <Route path="/app/bhudhi/beliefs" component={BhudhiBeliefsRoute} />
        <Route path="/bhudhi/world" component={BhudhiWorldRoute} />
        <Route path="/app/bhudhi/world" component={BhudhiWorldRoute} />
        <Route path="/bhudhi/identity" component={BhudhiIdentityRoute} />
        <Route path="/app/bhudhi/identity" component={BhudhiIdentityRoute} />
        <Route path="/bhudhi/organization" component={BhudhiOrganizationRoute} />
        <Route path="/app/bhudhi/organization" component={BhudhiOrganizationRoute} />
        <Route path="/bhudhi/experiments" component={BhudhiExperimentsRoute} />
        <Route path="/app/bhudhi/experiments" component={BhudhiExperimentsRoute} />
        <Route path="/bhudhi/temporal" component={BhudhiTemporalRoute} />
        <Route path="/app/bhudhi/temporal" component={BhudhiTemporalRoute} />
        <Route path="/bhudhi/governor" component={BhudhiMetaGovernorRoute} />
        <Route path="/app/bhudhi/governor" component={BhudhiMetaGovernorRoute} />
        <Route path="/bhudhi/reliability" component={BhudhiReliabilityRoute} />
        <Route path="/app/bhudhi/reliability" component={BhudhiReliabilityRoute} />
        <Route path="/bhudhi/security" component={BhudhiSecurityRoute} />
        <Route path="/app/bhudhi/security" component={BhudhiSecurityRoute} />
        <Route path="/bhudhi/infrastructure" component={BhudhiInfrastructureRoute} />
        <Route path="/app/bhudhi/infrastructure" component={BhudhiInfrastructureRoute} />
        <Route path="/bhudhi/teams" component={BhudhiTeamsRoute} />
        <Route path="/app/bhudhi/teams" component={BhudhiTeamsRoute} />
        <Route path="/bhudhi/erector" component={BhudhiErectorRoute} />
        <Route path="/app/bhudhi/erector" component={BhudhiErectorRoute} />
        <Route path="/bhudhi/civilization" component={BhudhiCivilizationRoute} />
        <Route path="/app/bhudhi/civilization" component={BhudhiCivilizationRoute} />
        <Route path="/bhudhi/expansion" component={BhudhiExpansionRoute} />
        <Route path="/app/bhudhi/expansion" component={BhudhiExpansionRoute} />
        <Route path="/app/torgima-bhudhi" component={TorgimaBhudhiRoute} />
        <Route path="/app/bhudhi/onboarding" component={BhudhiLaunchOnboardingRoute} />
        <Route path="/app/bhudhi" component={BhudhiUniversalRoute} />
        <Route path="/app/bhudhi/:section" component={BhudhiUniversalRoute} />
        <Route path="/bhudhi/:section" component={BhudhiUniversalRoute} />
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
    <ThemeProvider defaultTheme="dark" storageKey="torgima-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <UpgradeGate>
                <AppRoutes />
              </UpgradeGate>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
