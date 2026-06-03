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
import { apiGet, type TierPreviewCardDto } from "@/lib/torgima-api";
import type {
  BlueprintSelectionCatalogResponse,
  BlueprintTierCard,
  ValidationLaunchContext,
} from "@/lib/validation-launch-context";
import { EXECUTION_UNIT, LANGUAGE } from "@/lib/language";
import { TIER_CARD_TAGLINES } from "@/lib/onboarding-doc32";
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
    subtitle: TIER_CARD_TAGLINES.starter,
    tagline: TIER_CARD_TAGLINES.starter,
    recommended: false,
    setupTime: "~5 min",
    tasksPerDay: EXECUTION_UNIT.perDay(3),
    difficultyAccess: EXECUTION_UNIT.easyPlural,
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
    tasksPerDay: EXECUTION_UNIT.perDay(7),
    difficultyAccess: EXECUTION_UNIT.allTypes,
    structureDepth: "4 stages",
    price: "$29/month",
    bestFor: ["Growing businesses"],
    includes: ["Full signals"],
  },
  {
    id: "ultimate",
    label: "Ultimate",
    subtitle: TIER_CARD_TAGLINES.ultimate,
    tagline: TIER_CARD_TAGLINES.ultimate,
    recommended: false,
    setupTime: "~15 min",
    tasksPerDay: EXECUTION_UNIT.perDay(8),
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
  tierPreviews = [],
  selectingTier = null,
  onTierChange,
  onSelectTier,
  onBack,
  onLaunch,
  launching,
  launchEnabled = true,
  launchError,
  cardsLocked = false,
}: {
  context: ValidationLaunchContext;
  selectedTier: TierId | null;
  tierPreviews?: TierPreviewCardDto[];
  selectingTier?: TierId | null;
  onTierChange: (tier: TierId) => void;
  onSelectTier?: (tier: TierId) => void;
  onBack: () => void;
  onLaunch?: () => void;
  launching?: boolean;
  /** DOC 32 — activate only after tier configure succeeds */
  launchEnabled?: boolean;
  launchError?: string;
  cardsLocked?: boolean;
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
            const preview = tierPreviews.find((p) => p.tier === tier.id);
            const selected = selectedTier === tier.id;
            const selectable = isTierSelectable(subscriptionTier, tier.id) && !cardsLocked;
            const isBuilding = selectingTier === tier.id;
            const recommended = preview?.recommended ?? tier.recommended;
            return (
              <div
                key={tier.id}
                className={`relative flex flex-col text-left transition-all ${CARD} p-5 ${
                  !selectable && !cardsLocked
                    ? "opacity-60"
                    : selected
                      ? "border-[#5B21FF] bg-[#F5F3FF] ring-2 ring-[#5B21FF]/20"
                      : ""
                } ${cardsLocked && !isBuilding ? "pointer-events-none opacity-50" : ""}`}
              >
                {recommended && selectable ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#5B21FF] px-3 py-0.5 text-[10px] font-bold text-white">
                    Recommended
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
                <h3 className="mt-4 text-xl font-bold uppercase tracking-wide text-[#0B1220]">
                  {tier.label}
                </h3>
                {preview?.headline ? (
                  <p className="mt-1 text-sm font-semibold text-[#5B21FF]">{preview.headline}</p>
                ) : null}
                <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-[#64748B]">
                  {preview?.description ?? tier.tagline ?? tier.subtitle}
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-[#475569]">
                  {(preview?.highlights?.length ? preview.highlights.slice(0, 5) : [
                    tier.tasksPerDay ?? EXECUTION_UNIT.dailyFallback,
                    tier.difficultyAccess ?? EXECUTION_UNIT.difficultyFallback,
                    tier.structureDepth ?? tier.setupTime,
                  ]).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                {preview?.growthProjection ? (
                  <p className="mt-3 text-xs text-[#64748B]">
                    In 30 days: {preview.growthProjection.days30} · 60 days:{" "}
                    {preview.growthProjection.days60} · 90 days: {preview.growthProjection.days90}
                  </p>
                ) : (
                  <p className="mt-4 text-sm font-bold text-[#0B1220]">{tier.price ?? "—"}</p>
                )}
                <button
                  type="button"
                  disabled={!selectable || (cardsLocked && !isBuilding)}
                  onClick={() => {
                    if (!selectable) return;
                    onTierChange(tier.id);
                    if (onSelectTier) void onSelectTier(tier.id);
                    else if (onLaunch && !onSelectTier) onLaunch();
                  }}
                  className={`mt-4 inline-flex w-full items-center justify-center rounded-xl py-3 text-sm font-bold ${
                    !selectable
                      ? "border border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed"
                      : isBuilding
                        ? "bg-[#5B21FF]/80 text-white"
                        : "bg-[#5B21FF] text-white hover:opacity-95"
                  }`}
                >
                  {isBuilding
                    ? LANGUAGE.onboarding.structuringLabel
                    : !isTierSelectable(subscriptionTier, tier.id)
                      ? "Locked"
                      : onSelectTier
                        ? "Select level"
                        : "Select"}
                </button>
              </div>
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
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <p>{launchError}</p>
            {selectedTier && onSelectTier && !cardsLocked ? (
              <button
                type="button"
                className="mt-3 rounded-lg bg-[#5B21FF] px-4 py-2 text-xs font-bold text-white"
                onClick={() => onSelectTier(selectedTier)}
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#ECECF4] bg-white safe-area-pb">
        <div className="mx-auto flex max-w-5xl px-6 py-4 lg:px-10">
          <button
            type="button"
            disabled={cardsLocked}
            onClick={onBack}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#5B21FF]/30 px-6 py-2.5 text-sm font-semibold text-[#5B21FF] hover:bg-[#F5F3FF] disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to results
          </button>
          {onLaunch ? (
            <button
              type="button"
              disabled={launching || !selectedTier || cardsLocked || !launchEnabled}
              onClick={onLaunch}
              className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200/60 hover:opacity-95 disabled:opacity-50"
            >
              <Rocket className="h-4 w-4" />
              {launching ? LANGUAGE.onboarding.activatingLabel : LANGUAGE.onboarding.activateButton}
              {!launching ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
