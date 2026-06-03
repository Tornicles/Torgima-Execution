import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { DataConfidenceBadge, ExplanationPanel } from "@/components/erector/ExplanationPanel";
import type {
  CompetitorArchetype,
  EconomicContextModel,
  EnrichedCompetitorCard,
  EnrichedOpportunityCard,
} from "./validation-results-dashboard-model";

const CARD = "rounded-[20px] border border-[#ECECF4] bg-white shadow-sm";

function displayValue(value: unknown): string {
  if (value == null) return "—";
  const s = String(value).trim();
  if (!s || /^not available$/i.test(s)) return "—";
  return s;
}

function sharePercentFromCard(c: EnrichedCompetitorCard): number | null {
  if (c.marketSharePct != null && Number.isFinite(c.marketSharePct)) {
    return Math.min(100, Math.max(0, c.marketSharePct));
  }
  const m = c.marketShare.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n <= 1 ? n * 100 : n)) : null;
}

function impactBadgeClass(impact: string): string {
  const v = impact.toLowerCase();
  if (v.startsWith("h")) return "bg-emerald-50 text-emerald-700";
  if (v.startsWith("l")) return "bg-[#F8FAFC] text-[#64748B]";
  return "bg-amber-50 text-amber-700";
}

function impactLabel(impact: string): string {
  const v = impact.toLowerCase();
  if (v.startsWith("h")) return "HIGH";
  if (v.startsWith("l")) return "LOW";
  return "MEDIUM";
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function CompanyInitial({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B21FF] to-[#6D28D9] text-lg font-bold text-white">
      {initial}
    </div>
  );
}

export function EconomicEnvironmentSection({ economic }: { economic: EconomicContextModel }) {
  const ratingTone =
    economic.economicOpportunityRating === "High"
      ? "text-emerald-600"
      : economic.economicOpportunityRating === "Low"
        ? "text-red-600"
        : "text-amber-600";

  return (
    <section className={`${CARD} mt-8 p-6`}>
      <p className="text-xs font-bold uppercase tracking-wide text-[#0B1220]">
        Economic Environment — {economic.country}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Region</p>
          <p className="text-sm font-semibold text-[#0B1220]">{displayValue(economic.region)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Economic Zone</p>
          <p className="text-sm font-semibold text-[#0B1220]">{displayValue(economic.economicZone)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Market Maturity</p>
          <p className="text-sm font-semibold text-[#0B1220]">{displayValue(economic.marketMaturity)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Digital Access</p>
          <p className="text-sm font-semibold text-[#0B1220]">{displayValue(economic.digitalPenetration)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Political Climate</p>
          <p className="text-sm font-semibold text-[#0B1220]">{displayValue(economic.politicalClimate)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Business Environment</p>
          <p className="text-sm font-semibold text-[#0B1220]">{displayValue(economic.regulatoryEnvironment)}</p>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase text-[#94A3B8]">Local Market Dynamics</p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">
          {displayValue(economic.localMarketDynamics)}
        </p>
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase text-[#94A3B8]">Global Market Access</p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">
          {displayValue(economic.globalMarketAccess)}
        </p>
      </div>
      <p className={`mt-4 text-sm font-bold ${ratingTone}`}>
        Economic Opportunity Rating: ● {economic.economicOpportunityRating.toUpperCase()}
      </p>
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase text-[#94A3B8]">Overall Economic Summary</p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">{economic.economicSummary}</p>
      </div>
    </section>
  );
}

const ARCHETYPE_META: Record<
  CompetitorArchetype,
  { label: string; color: string; icon: string }
> = {
  pioneer: { label: "The Pioneer", color: "#1A2E4A", icon: "🏛" },
  fast_mover: { label: "The Fast-Mover", color: "#0D7377", icon: "⚡" },
  indie_survivor: { label: "The Indie-Survivor", color: "#5B2C8D", icon: "🔧" },
};

function PillarBlock({
  title,
  children,
  confidence,
  highlight,
}: {
  title: string;
  children: ReactNode;
  confidence?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`mt-4 rounded-xl border p-4 ${
        highlight ? "border-[#C7D2FE] bg-[#F5F3FF]/40" : "border-[#F1F5F9] bg-[#FAFBFC]"
      }`}
    >
      <p className="text-[10px] font-bold uppercase text-[#94A3B8]">{title}</p>
      <DataConfidenceBadge confidence={confidence} />
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#475569]">{children}</div>
    </div>
  );
}

function FootprintLinks({ footprint }: { footprint: EnrichedCompetitorCard["digitalFootprint"] }) {
  if (!footprint) return null;
  const links = [
    { label: "Website", url: footprint.website },
    { label: "Twitter", url: footprint.twitter },
    { label: "LinkedIn", url: footprint.linkedin },
    { label: "Community", url: footprint.community_hub },
    { label: "YouTube", url: footprint.youtube },
  ].filter((l) => l.url);
  if (links.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={String(l.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#5B21FF] hover:bg-[#F8FAFC]"
        >
          {l.label}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}

function CompetitorModal({
  competitors,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  competitors: EnrichedCompetitorCard[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const c = competitors[index];
  const meta = c?.archetype ? ARCHETYPE_META[c.archetype] : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!c) return null;

  const rl = c.revenueLifecycle;
  const ms = c.marketingStrategy;
  const gc = c.growthCatalyst;
  const fpo = c.firstProductOrigin;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {meta ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: meta.color }}
              >
                {meta.icon} {meta.label}
              </span>
            ) : null}
            <h3 className="mt-2 text-xl font-bold text-[#0B1220]">{c.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[#F8FAFC]" aria-label="Close">
            <X className="h-5 w-5 text-[#64748B]" />
          </button>
        </div>
        <p className="mt-1 text-sm text-[#64748B]">{c.description || c.tagline}</p>

        <ExplanationPanel text={c.drawerExplanation} />

        <PillarBlock title="Revenue Growth Lifecycle" confidence={rl?.data_confidence}>
          {rl?.year1_reality ? <p>Year 1: {rl.year1_reality}</p> : null}
          {rl?.inflection_point ? <p>Inflection: {rl.inflection_point}</p> : null}
          {rl?.current_scale ? <p>Current scale: {rl.current_scale}</p> : null}
          {!rl?.year1_reality && !rl?.inflection_point && !rl?.current_scale ? (
            <p>{c.estimatedRevenue}</p>
          ) : null}
        </PillarBlock>

        <PillarBlock title="Marketing & Distribution" confidence={ms?.data_confidence}>
          {ms?.primary_channel ? <p>Primary channel: {ms.primary_channel}</p> : null}
          {ms?.positioning_angle ? <p>Positioning: {ms.positioning_angle}</p> : null}
          {ms?.conversion_mechanism ? <p>Conversion: {ms.conversion_mechanism}</p> : null}
        </PillarBlock>

        <PillarBlock title="Core Growth Catalyst" confidence={gc?.data_confidence}>
          {gc?.distribution_hook ? <p>Distribution hook: {gc.distribution_hook}</p> : null}
          {gc?.retention_mechanics ? <p>Retention: {gc.retention_mechanics}</p> : null}
          {gc?.scale_trigger ? <p>Scale trigger: {gc.scale_trigger}</p> : null}
        </PillarBlock>

        <PillarBlock title="First Product Origin" confidence={fpo?.data_confidence} highlight>
          {fpo?.mvp_description ? <p>{fpo.mvp_description}</p> : null}
          {fpo?.day1_validation_method ? <p>Day 1 validation: {fpo.day1_validation_method}</p> : null}
          {fpo?.adjustment_history?.length ? (
            <ul className="list-disc pl-4">
              {fpo.adjustment_history.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          {fpo?.time_to_first_revenue ? <p>Time to first revenue: {fpo.time_to_first_revenue}</p> : null}
        </PillarBlock>

        <FootprintLinks footprint={c.digitalFootprint} />

        <p className="mt-4 text-[10px] font-bold uppercase text-emerald-600">Strengths</p>
        <ul className="mt-2 space-y-1">
          {c.strengths.map((s) => (
            <li key={s} className="text-sm text-[#475569]">
              • {s}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[10px] font-bold uppercase text-red-500">Weaknesses</p>
        <ul className="mt-2 space-y-1">
          {c.weaknesses.map((w) => (
            <li key={w} className="text-sm text-[#475569]">
              • {w}
            </li>
          ))}
        </ul>
        {c.differentiationHint ? (
          <div className="mt-4 rounded-xl border border-[#C7D2FE] bg-[#F5F3FF]/50 p-4">
            <p className="text-[10px] font-bold uppercase text-[#5B21FF]">Differentiation hint</p>
            <p className="mt-2 text-sm text-[#475569]">{c.differentiationHint}</p>
          </div>
        ) : null}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={index === 0}
            onClick={onPrev}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#5B21FF] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous Competitor
          </button>
          <button
            type="button"
            disabled={index >= competitors.length - 1}
            onClick={onNext}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#5B21FF] disabled:opacity-40"
          >
            Next Competitor
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CompetitorsSection({
  competitors,
  overviewExplanation,
  explanationsLoading,
}: {
  competitors: EnrichedCompetitorCard[];
  overviewExplanation?: string;
  explanationsLoading?: boolean;
}) {
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  return (
    <section className="lg:col-span-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0B1220]">Top 3 Competitors</p>
      <ExplanationPanel text={overviewExplanation} isLoading={explanationsLoading} />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {competitors.map((c, i) => {
          const sharePct = sharePercentFromCard(c);
          return (
          <article key={`${c.name}-${i}`} className={`${CARD} p-4`}>
            <CompanyInitial name={c.name} />
            <p className="mt-3 font-bold text-[#0B1220]">{c.name}</p>
            <p className="mt-1 text-xs text-[#64748B]">{c.tagline}</p>
            <div className="mt-3 grid grid-cols-1 gap-1 text-[11px] text-[#64748B]">
              <p>
                <span className="font-semibold text-[#0B1220]">Revenue:</span> {displayValue(c.estimatedRevenue)}
              </p>
              <p>
                <span className="font-semibold text-[#0B1220]">Users:</span> {displayValue(c.userBase)}
              </p>
              <p>
                <span className="font-semibold text-[#0B1220]">Since:</span> {displayValue(c.founded)}
              </p>
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase text-emerald-600">Strengths</p>
            <ul className="mt-1 space-y-0.5">
              {c.strengths.slice(0, 3).map((s) => (
                <li key={s} className="flex gap-1.5 text-xs text-[#475569]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] font-bold uppercase text-red-500">Weaknesses</p>
            <ul className="mt-1 space-y-0.5">
              {c.weaknesses.slice(0, 2).map((w) => (
                <li key={w} className="flex gap-1.5 text-xs text-[#475569]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                  {w}
                </li>
              ))}
            </ul>
            {sharePct != null ? (
              <>
                <p className="mt-3 text-[10px] font-semibold text-[#94A3B8]">Market Share</p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full bg-[#5B21FF] transition-all"
                    style={{ width: `${sharePct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs font-bold text-[#5B21FF]">{Math.round(sharePct)}%</p>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setModalIndex(i)}
              className="mt-3 text-xs font-semibold text-[#5B21FF] hover:underline"
            >
              Read More →
            </button>
          </article>
          );
        })}
      </div>
      {modalIndex != null ? (
        <CompetitorModal
          competitors={competitors}
          index={modalIndex}
          onClose={() => setModalIndex(null)}
          onPrev={() => setModalIndex((v) => (v != null && v > 0 ? v - 1 : v))}
          onNext={() =>
            setModalIndex((v) => (v != null && v < competitors.length - 1 ? v + 1 : v))
          }
        />
      ) : null}
    </section>
  );
}

function OpportunityCard({ opportunity }: { opportunity: EnrichedOpportunityCard }) {
  const [expanded, setExpanded] = useState(false);
  const preview = useMemo(() => truncateWords(opportunity.summary, 50), [opportunity.summary]);

  return (
    <article
      className={`${CARD} overflow-hidden p-4 transition-all duration-300 ${expanded ? "ring-1 ring-[#C7D2FE]" : ""}`}
    >
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${impactBadgeClass(opportunity.impact)}`}
      >
        {impactLabel(opportunity.impact)} IMPACT
      </span>
      <p className="mt-3 text-sm font-bold text-[#0B1220]">{opportunity.title}</p>
      <div
        className="mt-2 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? "400px" : "4.5rem" }}
      >
        <p className="text-sm leading-relaxed text-[#475569]">
          {expanded ? opportunity.summary : preview}
        </p>
      </div>
      <p className="mt-3 text-xs text-[#64748B]">
        <span className="font-semibold text-[#0B1220]">Time Window:</span> {displayValue(opportunity.timeWindow)}
      </p>
      <p className="mt-1 text-xs text-[#64748B]">
        <span className="font-semibold text-[#0B1220]">Market Signal:</span> {opportunity.marketSignal}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-3 text-xs font-semibold text-[#5B21FF] hover:underline"
      >
        {expanded ? "Hide Summary ↑" : "View Full Summary →"}
      </button>
    </article>
  );
}

export function OpportunitiesSection({
  opportunities,
  overviewExplanation,
  explanationsLoading,
}: {
  opportunities: EnrichedOpportunityCard[];
  overviewExplanation?: string;
  explanationsLoading?: boolean;
}) {
  return (
    <section className="lg:col-span-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0B1220]">Top Opportunities</p>
      <ExplanationPanel text={overviewExplanation} isLoading={explanationsLoading} />
      <div className="space-y-3">
        {opportunities.map((o) => (
          <OpportunityCard key={o.title} opportunity={o} />
        ))}
      </div>
    </section>
  );
}
