import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Crown,
  Lock,
  Rocket,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import { apiGet } from "@/lib/torgima-api";
import type {
  BlueprintSelectionCatalogResponse,
  BlueprintTierCard,
  ValidationLaunchContext,
} from "@/lib/validation-launch-context";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";

const CARD = "rounded-[20px] border border-[#ECECF4] bg-white shadow-sm";
const TIER_ICONS = { starter: Zap, growth: TrendingUp, ultimate: Crown } as const;
const TIER_RANK: Record<TierId, number> = { starter: 0, growth: 1, ultimate: 2 };

function normalizeSubscriptionTier(raw?: string | null): TierId {
  if (raw === "ultimate" || raw === "growth" || raw === "starter") return raw;
  return "starter";
}

function isTierSelectable(subscriptionTier: TierId, cardTier: TierId): boolean {
  return TIER_RANK[cardTier] <= TIER_RANK[subscriptionTier];
}

const FALLBACK_CARDS: BlueprintTierCard[] = [
  {
    id: "starter",
    label: "Starter",
    subtitle: "Getting going with a clear simple system",
    tagline: "Getting going with a clear simple system",
    recommended: false,
    setupTime: "~5 min",
    tasksPerDay: "3 tasks/day",
    difficultyAccess: "Easy tasks",
    structureDepth: "3 stages",
    price: "Free / $9/mo",
    bestFor: ["New ideas"],
    includes: ["Basic signals"],
  },
  {
    id: "growth",
    label: "Growth",
    subtitle: "Serious about building this into something real",
    tagline: "Serious about building this into something real",
    recommended: true,
    setupTime: "~10 min",
    tasksPerDay: "7 tasks/day",
    difficultyAccess: "All task types",
    structureDepth: "4 stages",
    price: "$29/month",
    bestFor: ["Growing businesses"],
    includes: ["Full signals"],
  },
  {
    id: "ultimate",
    label: "Ultimate",
    subtitle: "Maximum depth and control",
    tagline: "Maximum depth and control",
    recommended: false,
    setupTime: "~15 min",
    tasksPerDay: "8 tasks/day",
    difficultyAccess: "Advanced",
    structureDepth: "4 stages+",
    price: "$79/month",
    bestFor: ["Complex systems"],
    includes: ["All intelligence"],
  },
];

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
  selectedTier: TierId | null;
  onTierChange: (tier: TierId) => void;
  onBack: () => void;
  onLaunch: () => void;
  launching?: boolean;
  launchError?: string;
}) {
  const { data: me } = useGetMe();
  const [tierCards, setTierCards] = useState<BlueprintTierCard[]>(FALLBACK_CARDS);
  const [catalogError, setCatalogError] = useState("");

  const subscriptionTier = useMemo(
    () => normalizeSubscriptionTier(me?.tier),
    [me?.tier],
  );

  useEffect(() => {
    void apiGet<BlueprintSelectionCatalogResponse>("/api/blueprints/selection-catalog")
      .then((body) => {
        if (body?.tierCards?.length) setTierCards(body.tierCards);
        else setCatalogError("Could not load execution levels.");
      })
      .catch(() => setCatalogError("Could not load execution levels."));
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-5xl items-center px-6 py-6 lg:px-10">
        <TorgimaPreLaunchLogo />
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-32 pt-2 lg:px-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5B21FF]">
          Choose your execution level
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          CHOOSE YOUR EXECUTION LEVEL
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#64748B]">
          Your validation is complete. Now pick how deep your execution system runs.
        </p>

        {catalogError ? <p className="mt-3 text-sm text-red-600">{catalogError}</p> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {tierCards.map((tier) => {
            const Icon = TIER_ICONS[tier.id];
            const selected = selectedTier === tier.id;
            const selectable = isTierSelectable(subscriptionTier, tier.id);
            return (
              <button
                key={tier.id}
                type="button"
                disabled={!selectable}
                onClick={() => selectable && onTierChange(tier.id)}
                className={`relative flex flex-col text-left transition-all ${CARD} p-5 ${
                  !selectable
                    ? "cursor-not-allowed opacity-60"
                    : selected
                      ? "border-[#5B21FF] bg-[#F5F3FF] ring-2 ring-[#5B21FF]/20"
                      : "hover:border-[#C7D2FE]"
                }`}
              >
                {tier.recommended && selectable ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#5B21FF] px-3 py-0.5 text-[10px] font-bold text-white">
                    ⭐ Recommended
                  </span>
                ) : null}
                {!selectable ? (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                    <Lock className="h-3 w-3" />
                    Upgrade to unlock
                  </span>
                ) : selected ? (
                  <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#5B21FF] text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                ) : null}

                <span className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#5B21FF]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-lg font-bold uppercase tracking-wide text-[#0B1220]">
                  {tier.label}
                </h3>
                <p className="mt-2 min-h-[40px] text-sm leading-snug text-[#64748B]">
                  {tier.tagline ?? tier.subtitle}
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-[#475569]">
                  <li>{tier.tasksPerDay ?? "Daily tasks"}</li>
                  <li>{tier.difficultyAccess ?? "Task difficulty"}</li>
                  <li>{tier.structureDepth ?? tier.setupTime}</li>
                  <li>{tier.includes[0] ?? "Signals included"}</li>
                </ul>
                <p className="mt-4 text-sm font-bold text-[#0B1220]">{tier.price ?? "—"}</p>
                <span
                  className={`mt-4 inline-flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-bold ${
                    selectable
                      ? selected
                        ? "bg-[#5B21FF] text-white"
                        : "border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]"
                      : "border border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
                  }`}
                >
                  {selectable ? (selected ? "Selected" : "Select") : "Locked"}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-[#64748B]">
          Already on a plan? Your plan determines what&apos;s available.{" "}
          <Link href="/upgrade" className="font-semibold text-[#5B21FF] hover:underline">
            You can upgrade anytime.
          </Link>
        </p>

        <div className="mt-6 rounded-[16px] border border-[#ECECF4] bg-[#F8FAFC] px-4 py-3 text-xs text-[#64748B]">
          <span className="font-semibold text-[#0B1220]">Selected direction:</span>{" "}
          {context.directionLabel} · {context.goal.slice(0, 80)}
          {context.goal.length > 80 ? "…" : ""}
        </div>
      </main>

      {launchError ? (
        <div className="mx-auto max-w-5xl px-6 pb-4">
          <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{launchError}</p>
        </div>
      ) : null}

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#ECECF4] bg-white safe-area-pb">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#5B21FF]/30 px-6 py-2.5 text-sm font-semibold text-[#5B21FF] hover:bg-[#F5F3FF]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to results
          </button>
          <button
            type="button"
            disabled={launching || !selectedTier}
            onClick={onLaunch}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200/60 hover:opacity-95 disabled:opacity-50 sm:w-auto"
          >
            <Rocket className="h-4 w-4" />
            {launching ? "Launching your project…" : "Continue to Launch →"}
            {!launching ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </footer>
    </div>
  );
}
