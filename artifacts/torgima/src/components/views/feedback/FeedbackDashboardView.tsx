import { useLocation } from "wouter";
import { Shield, Lightbulb, TrendingUp } from "lucide-react";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { cards, PageLoading } from "@/design";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { StructuredFeedbackFlow } from "@/components/feedback/StructuredFeedbackFlow";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDashboardStateQueryKey } from "@workspace/api-client-react";

export function FeedbackDashboardView() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    orders,
    completionRate,
    streak,
    momentum,
    conditionLabel,
    conditionRaw,
    isLoading,
    blueprint,
  } = useDashboardMetrics();

  const blueprintId = blueprint?.id;
  const completed = orders.filter((o) =>
    ["completed", "done", "finished"].includes(String(o.status).toLowerCase()),
  ).length;
  const total = orders.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const conditionImpact =
    completionRate >= 70 ? "Positive" : completionRate >= 40 ? "Neutral" : "Negative";
  const impactColor =
    conditionImpact === "Positive"
      ? "text-[var(--torgima-primary)]"
      : conditionImpact === "Negative"
        ? "text-red-600"
        : "text-orange-500";

  if (isLoading) return <PageLoading />;

  return (
    <DashboardPageLayout
      title="Feedback"
      subtitle="Describe what happened. Signals and condition adapt automatically — no self-scoring."
      stats={
        <MetricStatRow>
          <MetricStatCard
            label="Tasks completed"
            value={`${completed} / ${total || "—"}`}
            sub={<ProgressBar value={pct} />}
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          />
          <MetricStatCard
            label="Condition"
            value={conditionLabel}
            sub="System-assigned from your reality"
            valueClassName={impactColor}
            icon={<Shield className="w-5 h-5 text-gray-400" />}
          />
          <MetricStatCard
            label="Streak"
            value={`${streak} days`}
            sub="Consistency"
            valueClassName="text-orange-500"
            icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
          />
          <MetricStatCard
            label="Momentum"
            value={`${momentum >= 0 ? "+" : ""}${momentum}`}
            sub="vs prior period"
            valueClassName="text-purple-600"
            icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          />
        </MetricStatRow>
      }
      rightRail={
        <>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Golden rules</p>
            <ul className="space-y-2 text-sm text-gray-600 list-disc pl-4">
              <li>You describe reality — never rate yourself 1–10</li>
              <li>Signals show Production, Operations, Growth, Scale</li>
              <li>Condition is assigned automatically</li>
            </ul>
          </div>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">How feedback is used</p>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal pl-4">
              <li>You describe what happened</li>
              <li>BHUDHI interprets reality</li>
              <li>Signals update → condition adjusts</li>
              <li>New orders are generated</li>
            </ol>
            <p className="text-xs text-[var(--torgima-primary)] italic mt-4 flex gap-2">
              <Lightbulb className="w-4 h-4 shrink-0" />
              Be honest. The system decides the rest.
            </p>
          </div>
        </>
      }
    >
      {blueprintId ? (
        <StructuredFeedbackFlow
          blueprintId={blueprintId}
          onSkip={() => setLocation("/dashboard")}
          onComplete={(message) => {
            toast({ title: "Feedback recorded", description: message });
            void queryClient.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() });
            setTimeout(() => setLocation("/dashboard"), 1500);
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Activate a blueprint to submit structured feedback.</p>
      )}
    </DashboardPageLayout>
  );
}
