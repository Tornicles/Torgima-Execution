import { Link } from "wouter";
import { Rocket } from "lucide-react";
import type { LaunchFirstLoadProjection } from "@/lib/dashboard-types";
import { getDifficultyLabel, getTrendLabel, LANGUAGE } from "@/lib/language";
import {
  BLUEPRINT_LABELS,
  DEFAULT_CONDITION,
  describeCondition,
  getConditionLabel,
} from "@/lib/language-map";

const PURPLE = "#5B21FF";

export function LaunchNothingnessDashboard({ launch }: { launch: LaunchFirstLoadProjection }) {
  const cond = launch.activeCondition;
  const conditionKey = cond?.condition ?? DEFAULT_CONDITION;
  const conditionLabel = getConditionLabel(conditionKey);
  const conditionDescription = describeCondition(conditionKey);
  const sig = launch.signals;
  const orders = launch.orders ?? [];
  const insights = launch.validationInsights;

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[#4C1D95] bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4C1D95] p-6 text-white shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">
          {BLUEPRINT_LABELS.conditions}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">{conditionLabel}</h2>
        <p className="mt-3 text-sm leading-relaxed text-violet-100">{conditionDescription}</p>
        <div className="mt-5 grid gap-2 text-sm text-violet-50 sm:grid-cols-2">
          <p>✓ {cond?.taskLimitMax ?? 8} foundation steps are ready for you</p>
          <p>✓ Start with any step — complete it and submit feedback</p>
          <p>✓ Your condition will evolve as you execute</p>
          <p>✓ The system will adapt your workload based on your progress</p>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-200">
          Next: {conditionDescription}
        </p>
      </section>

      <section className="rounded-[16px] border border-[#E8ECF0] bg-[#F8FAFC] px-4 py-3">
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#475569]">
          <span>
            {LANGUAGE.progress.completionRate}: {Math.round((sig?.completionRate ?? 0) * 100)}%
          </span>
          <span>
            {LANGUAGE.progress.executionQuality}: {sig?.weightedScore ?? 0}
          </span>
          <span>
            {LANGUAGE.progress.streak}: {sig?.momentum ?? 0}
          </span>
          <span>
            {LANGUAGE.progress.direction}: {getTrendLabel(sig?.trend)}
          </span>
        </div>
        <p className="mt-2 text-xs text-[#64748B]">{LANGUAGE.progress.noData}</p>
      </section>

      <section>
        <h3 className="text-xl font-bold text-[#0F172A]">Your first steps</h3>
        <p className="mt-1 text-sm text-[#64748B]">
          These steps are built from your validation. Complete them to build momentum.
        </p>
        <div className="mt-4 grid gap-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-[20px] border border-[#ECECF4] bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    order.priorityLabel === "High"
                      ? "border-red-100 bg-red-50 text-red-700"
                      : order.priorityLabel === "Medium"
                        ? "border-amber-100 bg-amber-50 text-amber-800"
                        : "border-gray-100 bg-gray-50 text-gray-600"
                  }`}
                >
                  {order.priorityLabel ?? "Standard"}
                </span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {getDifficultyLabel(order.difficulty ?? "easy")}
                </span>
                <span className="text-[10px] text-[#64748B]">
                  ~{order.timeEstimateMinutes ?? 30} min
                </span>
              </div>
              <h4 className="text-lg font-bold text-[#0F172A]">{order.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">{order.instruction}</p>
              <p className="mt-3 text-xs text-[#64748B]">
                <span className="font-semibold text-[#0F172A]">Expected output:</span>{" "}
                {order.expectedOutput}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                <span className="font-semibold text-[#0F172A]">Definition of done:</span>{" "}
                {order.definitionOfDone}
              </p>
              {order.whyItMatters ? (
                <p className="mt-2 text-xs text-[#5B21FF]">
                  <span className="font-semibold">Why this matters:</span> {order.whyItMatters}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/execute?orderId=${order.id}`}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${PURPLE}, #6D28D9)` }}
                  >
                    <Rocket className="h-4 w-4" />
                    Start →
                  </button>
                </Link>
                <Link href={`/execute?orderId=${order.id}&view=details`}>
                  <button
                    type="button"
                    className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]"
                  >
                    View details →
                  </button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {insights ? (
        <section className="rounded-[16px] border border-[#E8ECF0] bg-white px-4 py-3 text-sm text-[#475569]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Your validation insights
          </p>
          <p className="mt-2">
            Goal: {insights.goal} · Verdict: {insights.verdict} · Reality score:{" "}
            {insights.realityScore ?? "—"}% · Path: {insights.selectedPath}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            These steps are aligned with your validated direction.
          </p>
        </section>
      ) : null}
    </div>
  );
}
