import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  Crown,
  Lock,
  Rocket,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import { apiGet } from "@/lib/torgima-api";
import type {
  BlueprintCreationFlowStep,
  BlueprintSelectionCatalogResponse,
  BlueprintTierCard,
  ValidationLaunchContext,
} from "@/lib/validation-launch-context";
import { BlueprintLaunchStepper } from "./BlueprintLaunchStepper";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";

const CARD = "rounded-[20px] border border-[#ECECF4] bg-white shadow-sm";
const TIER_ICONS = { starter: Rocket, growth: TrendingUp, ultimate: Crown } as const;

export function BlueprintLaunchInputScreen({
  context,
  selectedTier,
  onTierChange,
  onBack,
  onLaunch,
  launching,
  launchError,
}: {
  context: ValidationLaunchContext;
  selectedTier: TierId;
  onTierChange: (tier: TierId) => void;
  onBack: () => void;
  onLaunch: () => void;
  launching?: boolean;
  launchError?: string;
}) {
  const { data: me } = useGetMe();
  const [tierCards, setTierCards] = useState<BlueprintTierCard[]>([]);
  const [creationFlow, setCreationFlow] = useState<BlueprintCreationFlowStep[]>([]);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    void apiGet<BlueprintSelectionCatalogResponse>("/api/blueprints/selection-catalog")
      .then((body) => {
        if (body?.tierCards?.length) setTierCards(body.tierCards);
        if (body?.creationFlow?.length) setCreationFlow(body.creationFlow);
        if (!body?.tierCards?.length) setCatalogError("Could not load blueprint tiers.");
      })
      .catch(() => setCatalogError("Could not load blueprint tiers."));
  }, []);

  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Visionary";
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const dayLabel = today.toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-[1536px] flex-wrap items-start justify-between gap-4 px-6 pb-2 pt-6 lg:px-10">
        <TorgimaPreLaunchLogo />
        <div className="hidden flex-1 justify-center lg:flex">
          <BlueprintLaunchStepper />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`${CARD} px-4 py-3`}>
            <p className="flex items-center gap-2 text-sm font-bold text-[#0B1220]">
              <Rocket className="h-4 w-4 text-[#5B21FF]" />
              READY TO LAUNCH
            </p>
            <p className="mt-0.5 text-xs text-[#64748B]">You&apos;re one step away from execution.</p>
          </div>
          <div className={`${CARD} flex items-center gap-2 px-3 py-2`}>
            <Calendar className="h-4 w-4 text-[#5B21FF]" />
            <div>
              <p className="text-sm font-semibold">{dateLabel}</p>
              <p className="text-xs text-[#94A3B8]">{dayLabel}</p>
            </div>
          </div>
          <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#ECECF4]">
            <Bell className="h-5 w-5 text-[#64748B]" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#5B21FF] text-[9px] font-bold text-white">
              3
            </span>
          </button>
          <button type="button" className={`${CARD} flex items-center gap-2 px-2 py-1.5`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#5B21FF] to-[#6D28D9] text-sm font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-[#94A3B8]">Level 7</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 lg:hidden">
        <BlueprintLaunchStepper />
      </div>

      <div className="mx-auto max-w-4xl px-6 pt-6 text-center lg:px-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Launch Your Execution Blueprint 🚀
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#64748B]">
          Choose your blueprint level.
          <br />
          Each blueprint includes everything you need to execute with clarity, structure, and adaptive control.
        </p>
      </div>

      <main className="mx-auto grid max-w-[1536px] gap-8 px-6 pb-40 pt-8 lg:grid-cols-[1fr_320px] lg:px-10">
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#0B1220]">
              Choose Your Blueprint Level
            </h2>
            {catalogError ? <p className="mt-2 text-sm text-red-600">{catalogError}</p> : null}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {tierCards.map((tier) => {
                const Icon = TIER_ICONS[tier.id];
                const selected = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => onTierChange(tier.id)}
                    className={`relative text-left transition-all ${CARD} p-5 ${
                      selected
                        ? "border-[#5B21FF] bg-[#F5F3FF] ring-2 ring-[#5B21FF]/20"
                        : "hover:border-[#C7D2FE]"
                    }`}
                  >
                    <span
                      className={`absolute left-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        selected ? "border-[#5B21FF] bg-[#5B21FF]" : "border-[#CBD5E1] bg-white"
                      }`}
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                    </span>
                    {tier.recommended ? (
                      <span className="absolute right-4 top-4 rounded-full bg-[#5B21FF] px-2.5 py-0.5 text-[10px] font-bold text-white">
                        Recommended
                      </span>
                    ) : null}
                    <span className="mt-8 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#5B21FF]">
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                    <h3 className="mt-3 text-base font-bold text-[#0B1220]">{tier.label}</h3>
                    <p className="mt-1 text-xs text-[#64748B]">{tier.subtitle}</p>
                    <ul className="mt-4 space-y-1.5">
                      {tier.includes.map((line) => (
                        <li key={line} className="flex gap-2 text-xs text-[#475569]">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5B21FF]" strokeWidth={2.5} />
                          {line}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-[11px] text-[#64748B]">
                      <span className="font-semibold text-[#0B1220]">Best for:</span> {tier.bestFor.join(", ")}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#5B21FF]">
                      Setup Time: {tier.setupTime}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${CARD} p-6`}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#0B1220]">
              What Will Be Created?
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {creationFlow.map((step, i) => (
                <div key={step.key} className="flex items-center gap-2">
                  <div className="flex min-w-[88px] flex-col items-center rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] px-3 py-3 text-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EDE9FE] text-[#5B21FF]">
                      <Zap className="h-4 w-4" />
                    </span>
                    <p className="mt-2 text-xs font-bold text-[#0B1220]">{step.label}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-[#94A3B8]">{step.description}</p>
                  </div>
                  {i < creationFlow.length - 1 ? (
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-[#CBD5E1] sm:block" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className={`${CARD} p-5`}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#5B21FF]">
              Your Blueprint Summary
            </h3>
            <dl className="mt-4 space-y-3 text-xs">
              <div>
                <dt className="font-semibold text-[#94A3B8]">Goal</dt>
                <dd className="mt-0.5 font-medium text-[#0B1220]">{context.goal || "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#94A3B8]">Purpose</dt>
                <dd className="mt-0.5 text-[#475569]">{context.purpose || "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#94A3B8]">Timeframe</dt>
                <dd className="mt-0.5 text-[#475569]">{context.timeframeLabel}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#94A3B8]">Context</dt>
                <dd className="mt-0.5 text-[#475569]">
                  {context.domain}
                  <br />
                  {context.location} • {context.commitmentLevel}
                  <br />
                  {context.verdict ? `Verdict: ${context.verdict}` : null}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#94A3B8]">Selected Direction</dt>
                <dd className="mt-0.5 font-semibold text-emerald-600">{context.directionLabel}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[20px] border border-[#C7D2FE] bg-[#F5F3FF]/50 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0B1220]">
              What Happens After Launch?
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#475569]">
              {[
                "Your blueprint will be generated instantly.",
                "Plans will be created.",
                "Programs will be created.",
                "Phases will be created.",
                "Projects will be created.",
                "Actions will be created.",
                "Daily Orders will be generated.",
                "Signals will begin tracking execution.",
                "Condition Control will begin adapting workload.",
                "Bhudhi AI will begin monitoring execution patterns.",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5B21FF]" strokeWidth={2.5} />
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section className={`${CARD} flex items-start gap-3 p-4`}>
            <Shield className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-[#64748B]">
              Your data is private and secure.
              <br />
              We never store or share your information.
            </p>
          </section>
        </aside>
      </main>

      {launchError ? (
        <div className="mx-auto max-w-[1536px] px-6 pb-4">
          <pre className="whitespace-pre-wrap rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700">
            {launchError}
          </pre>
        </div>
      ) : null}

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#ECECF4] bg-white">
        <div className="mx-auto flex max-w-[1536px] flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#5B21FF]/30 px-6 py-2.5 text-sm font-semibold text-[#5B21FF] hover:bg-[#F5F3FF]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <p className="flex items-center justify-center gap-2 text-center text-xs text-[#94A3B8] sm:order-first sm:flex-1">
            <Lock className="h-3.5 w-3.5 text-[#5B21FF]" />
            This will build your execution system and start your journey.
          </p>
          <button
            type="button"
            disabled={launching || !selectedTier}
            onClick={onLaunch}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200/60 hover:opacity-95 disabled:opacity-50 sm:w-auto"
          >
            <Rocket className="h-4 w-4" />
            {launching ? "Building your blueprint…" : "Launch This Blueprint"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
