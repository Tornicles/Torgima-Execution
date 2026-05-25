import { useState } from "react";
import { useLocation } from "wouter";
import { Flame, Lightbulb, Send, Shield, Star, TrendingUp } from "lucide-react";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { StickyFooter } from "@/components/design-system/StickyFooter";
import { cards, buttons, PageLoading } from "@/design";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { submitOrderFeedback } from "@/lib/torgima-api";
import { useToast } from "@/hooks/use-toast";

function isDone(status: string) {
  return ["completed", "done", "finished"].includes(status.toLowerCase());
}

export function FeedbackDashboardView() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { orders, dailyScore, completionRate, streak, momentum, conditionLabel, conditionRaw, isLoading } =
    useDashboardMetrics();
  const [score, setScore] = useState(Math.round(dailyScore) || 7);
  const [reflection, setReflection] = useState("");
  const [confidence, setConfidence] = useState("high");
  const [whyConfidence, setWhyConfidence] = useState("");
  const [taskStatus, setTaskStatus] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const completed = orders.filter((o) => isDone(taskStatus[o.id] ?? o.status)).length;
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

  async function submitDaily() {
    const targets = orders.filter((o) => isDone(taskStatus[o.id] ?? o.status));
    if (targets.length === 0) {
      toast({ title: "Mark at least one task", description: "Select completed tasks before submitting." });
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        targets.map((order) =>
          submitOrderFeedback(order.id, {
            completionStatus: "completed",
            score,
            reflection: reflection.length >= 10 ? reflection : "Daily feedback submitted with honest reflection on today's execution.",
            idempotencyKey: `daily-${order.id}-${Date.now()}`,
          }),
        ),
      );
      toast({ title: "Feedback submitted", description: "Signals will update from your reality." });
      setTimeout(() => setLocation("/dashboard"), 2000);
    } catch {
      toast({ title: "Submission failed", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <PageLoading />;

  return (
    <DashboardPageLayout
      title="Feedback"
      subtitle="Your reality input. Our system adapts."
      stats={
        <MetricStatRow>
          <MetricStatCard label="Daily Score" value={`${score} / 10`} sub="Good execution today" valueClassName="text-emerald-600" icon={<Star className="w-5 h-5 text-emerald-500" />} />
          <MetricStatCard label="Tasks Completed" value={`${completed} / ${total || "—"}`} sub={<ProgressBar value={pct} />} icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} />
          <MetricStatCard label="Condition Impact" value={conditionImpact} sub={`Supports ${conditionLabel}`} valueClassName={impactColor} icon={<Shield className="w-5 h-5 text-gray-400" />} />
          <MetricStatCard label="Streak" value={`${streak} days`} sub="Keep it up" valueClassName="text-orange-500" icon={<Flame className="w-5 h-5 text-orange-500" />} />
          <MetricStatCard label="Week Trend" value={`${momentum >= 0 ? "+" : ""}${momentum}%`} sub="vs last week" valueClassName="text-purple-600" icon={<TrendingUp className="w-5 h-5 text-purple-500" />} />
        </MetricStatRow>
      }
      rightRail={
        <>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Execution insights</p>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2">
                <Shield className="w-4 h-4 text-[var(--torgima-primary)] shrink-0" />
                <span>{completionRate >= 60 ? "You're on track" : "Focus on completing today's orders"}</span>
              </li>
              <li className="flex gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Condition: {conditionRaw.replace(/_/g, " ")} — keep feedback honest.</span>
              </li>
              <li className="flex gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--torgima-primary)] shrink-0" />
                <span>Momentum {momentum >= 0 ? "improving" : "needs attention"} ({momentum}%)</span>
              </li>
            </ul>
          </div>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">How feedback is used</p>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal pl-4">
              <li>You give feedback</li>
              <li>Signals updated</li>
              <li>Condition adjusted</li>
              <li>Orders optimized</li>
            </ol>
            <p className="text-xs text-[var(--torgima-primary)] italic mt-4">Be honest. Be consistent.</p>
          </div>
        </>
      }
      footer={
        <StickyFooter
          message="Your feedback is protected and used only to improve your execution journey."
          action={
            <div className="flex gap-2">
              <button type="button" className={buttons.secondary} disabled={submitting}>
                Save Draft
              </button>
              <button type="button" onClick={() => void submitDaily()} disabled={submitting} className={`${buttons.primary} inline-flex items-center gap-2`}>
                <Send className="w-4 h-4" /> Submit Feedback
              </button>
            </div>
          }
        />
      }
    >
      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">1. How did you perform today?</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`w-10 h-10 rounded-full text-sm font-bold ${
                score === n ? "bg-[var(--torgima-primary)] text-white" : "border border-gray-200 text-gray-600"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className={cards.padded}>
        <div className="flex justify-between mb-4">
          <p className="text-xs font-bold uppercase text-gray-500">2. Task completion</p>
          <span className="text-sm text-gray-600">{completed} of {total} completed</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {orders.map((o) => (
            <li key={o.id} className="py-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={isDone(taskStatus[o.id] ?? o.status)}
                onChange={() =>
                  setTaskStatus((s) => ({
                    ...s,
                    [o.id]: isDone(s[o.id] ?? o.status) ? "pending" : "completed",
                  }))
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="flex-1 text-sm text-gray-900">{o.title}</span>
              <span className="text-xs text-gray-500 capitalize">{(taskStatus[o.id] ?? o.status).replace("_", " ")}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-2">3. Reflection</p>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="What went well today? What can improve?"
          className="w-full min-h-[100px] rounded-lg border border-gray-200 p-3 text-sm"
          maxLength={500}
        />
        <p className="text-xs text-gray-400 text-right mt-1">{reflection.length}/500</p>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-2">4. Confidence level</p>
        <select
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="very_low">Very Low</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="very_high">Very High</option>
        </select>
        <textarea
          value={whyConfidence}
          onChange={(e) => setWhyConfidence(e.target.value)}
          placeholder="Why?"
          className="w-full mt-2 min-h-[72px] rounded-lg border border-gray-200 p-3 text-sm"
          maxLength={300}
        />
        <p className="text-xs text-gray-400 text-right mt-1">{whyConfidence.length}/300</p>
      </div>
    </DashboardPageLayout>
  );
}
