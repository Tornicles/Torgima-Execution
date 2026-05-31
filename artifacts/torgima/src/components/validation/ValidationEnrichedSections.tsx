import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type {
  EconomicContextModel,
  EnrichedCompetitorCard,
  EnrichedOpportunityCard,
} from "./validation-results-dashboard-model";

const CARD = "rounded-[20px] border border-[#ECECF4] bg-white shadow-sm";

function parseSharePercent(share: string): number {
  const m = share.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 20;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.min(100, Math.max(5, n <= 1 ? n * 100 : n)) : 20;
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
          <p className="text-sm font-semibold text-[#0B1220]">{economic.region}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Economic Zone</p>
          <p className="text-sm font-semibold text-[#0B1220]">{economic.economicZone}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Market Maturity</p>
          <p className="text-sm font-semibold text-[#0B1220]">{economic.marketMaturity}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Digital Access</p>
          <p className="text-sm font-semibold text-[#0B1220]">{economic.digitalPenetration}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Political Climate</p>
          <p className="text-sm font-semibold text-[#0B1220]">{economic.politicalClimate}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Business Environment</p>
          <p className="text-sm font-semibold text-[#0B1220]">{economic.regulatoryEnvironment}</p>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase text-[#94A3B8]">Local Market Dynamics</p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">{economic.localMarketDynamics}</p>
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase text-[#94A3B8]">Global Market Access</p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">{economic.globalMarketAccess}</p>
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!c) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold text-[#0B1220]">{c.name}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[#F8FAFC]" aria-label="Close">
            <X className="h-5 w-5 text-[#64748B]" />
          </button>
        </div>
        <p className="mt-1 text-sm text-[#64748B]">{c.tagline}</p>
        <hr className="my-4 border-[#F1F5F9]" />
        <p className="text-[10px] font-bold uppercase text-[#94A3B8]">About This Company</p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">{c.description}</p>
        <p className="mt-4 text-[10px] font-bold uppercase text-[#94A3B8]">Scale &amp; Reach</p>
        <p className="mt-2 text-sm text-[#475569]">
          Founded: {c.founded} | Revenue: {c.estimatedRevenue} | Users: {c.userBase}
        </p>
        <p className="mt-1 text-sm text-[#475569]">Geography: {c.geography}</p>
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
        <p className="mt-4 text-[10px] font-bold uppercase text-[#5B21FF]">Where Your Idea Fits</p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">{c.whereYourIdeaFits}</p>
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

export function CompetitorsSection({ competitors }: { competitors: EnrichedCompetitorCard[] }) {
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  return (
    <section className="lg:col-span-5">
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-[#0B1220]">Top 3 Competitors</p>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {competitors.map((c, i) => (
          <article key={`${c.name}-${i}`} className={`${CARD} p-4`}>
            <CompanyInitial name={c.name} />
            <p className="mt-3 font-bold text-[#0B1220]">{c.name}</p>
            <p className="mt-1 text-xs text-[#64748B]">{c.tagline}</p>
            <div className="mt-3 grid grid-cols-1 gap-1 text-[11px] text-[#64748B]">
              <p>
                <span className="font-semibold text-[#0B1220]">Revenue:</span> {c.estimatedRevenue}
              </p>
              <p>
                <span className="font-semibold text-[#0B1220]">Users:</span> {c.userBase}
              </p>
              <p>
                <span className="font-semibold text-[#0B1220]">Since:</span> {c.founded}
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
            <p className="mt-3 text-[10px] font-semibold text-[#94A3B8]">Market Share</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
              <div
                className="h-full rounded-full bg-[#5B21FF] transition-all"
                style={{ width: `${parseSharePercent(c.marketShare)}%` }}
              />
            </div>
            <p className="mt-1 text-xs font-bold text-[#5B21FF]">{c.marketShare}</p>
            <button
              type="button"
              onClick={() => setModalIndex(i)}
              className="mt-3 text-xs font-semibold text-[#5B21FF] hover:underline"
            >
              Read More →
            </button>
          </article>
        ))}
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
        <span className="font-semibold text-[#0B1220]">Time Window:</span> {opportunity.timeWindow}
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

export function OpportunitiesSection({ opportunities }: { opportunities: EnrichedOpportunityCard[] }) {
  return (
    <section className="lg:col-span-3">
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-[#0B1220]">Top Opportunities</p>
      <div className="space-y-3">
        {opportunities.map((o) => (
          <OpportunityCard key={o.title} opportunity={o} />
        ))}
      </div>
    </section>
  );
}
