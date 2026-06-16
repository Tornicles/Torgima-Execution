import type { PostFreeValidationContext } from "./limited-dashboard-types";

function scoreBarLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Limited";
  return "Weak";
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold text-[#0F172A]">
        <span>{label}</span>
        <span className="text-[#64748B]">{scoreBarLabel(score)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
        <div className="h-full rounded-full bg-[#5B21FF] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const UPGRADE_PLANS: Array<{
  id: string;
  name: string;
  price: string;
  feature: string;
  highlighted?: boolean;
}> = [
  {
    id: "starter",
    name: "Starter",
    price: "From $29/mo",
    feature: "Full 8-section analysis and execution project",
  },
  {
    id: "growth",
    name: "Growth",
    price: "From $79/mo",
    feature: "Deeper market intelligence and adaptive planning",
    highlighted: true,
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: "From $149/mo",
    feature: "Maximum intelligence depth and priority support",
  },
];

export function VariantA_PostFreeValidation({
  context,
  userEmail,
}: {
  context: PostFreeValidationContext;
  userEmail: string;
}) {
  const handoffToken =
    typeof window !== "undefined"
      ? localStorage.getItem("torgima_handoff_token") ??
        sessionStorage.getItem("torgima_pending_handoff_token")
      : null;

  const intakeHref = handoffToken
    ? `/onboarding/intake?handoff=${encodeURIComponent(handoffToken)}`
    : "/onboarding/intake";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-3xl rounded-[24px] border border-[#E8ECF0] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#5B21FF] px-6 py-8 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">{userEmail}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Your Free Analysis</h1>
          <p className="mt-3 text-sm text-violet-100">{context.upgrade_cta_headline}</p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-[#5B21FF]">Preview result</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A]">{context.free_verdict_label}</p>
            <p className="mt-3 text-sm text-[#475569] leading-relaxed">{context.explanation_summary}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ScoreBar label="Market Potential" score={context.market_score} />
            <ScoreBar label="Resource Fit" score={context.feasibility_score} />
          </div>

          <div className="rounded-2xl border border-[#E8ECF0] bg-[#F8FAFC] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">What full analysis adds</p>
            <ul className="mt-3 space-y-2 text-sm text-[#475569] list-disc pl-5">
              <li>Demand proof evaluation — do people actually want this?</li>
              <li>Economic archetype matching — which business model suits your context?</li>
              <li>Three execution paths with probability scores</li>
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {UPGRADE_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border p-4 ${
                  plan.highlighted ? "border-[#5B21FF] bg-violet-50/50" : "border-[#E8ECF0] bg-white"
                }`}
              >
                <p className="text-sm font-bold text-[#0F172A]">{plan.name}</p>
                <p className="mt-1 text-xs text-[#64748B]">{plan.price}</p>
                <p className="mt-2 text-xs text-[#475569]">{plan.feature}</p>
                <a
                  href={intakeHref}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#5B21FF] px-3 py-2 text-xs font-bold text-white hover:bg-[#4C1D95]"
                >
                  Start Full Analysis
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
