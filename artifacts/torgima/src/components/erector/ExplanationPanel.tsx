import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

function truncateToMaxWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  const clipped = words.slice(0, maxWords).join(" ");
  const lastPeriod = clipped.lastIndexOf(".");
  if (lastPeriod > clipped.length * 0.5) {
    return clipped.slice(0, lastPeriod + 1).trim();
  }
  return `${clipped}…`;
}

function ExplanationSkeleton() {
  return (
    <div className="mt-3 rounded-xl border border-[#E8ECF4] bg-[#F8FAFC] px-4 py-3" aria-hidden>
      <div className="h-2.5 w-full max-w-md animate-pulse rounded bg-[#E2E8F0]" />
      <div className="mt-2 h-2.5 w-4/5 max-w-sm animate-pulse rounded bg-[#E2E8F0]" />
      <div className="mt-2 h-2.5 w-3/5 max-w-xs animate-pulse rounded bg-[#E2E8F0]" />
    </div>
  );
}

export interface ExplanationPanelProps {
  text: string | null | undefined;
  isLoading?: boolean;
  defaultExpanded?: boolean;
}

export function ExplanationPanel({ text, isLoading, defaultExpanded }: ExplanationPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);

  useEffect(() => {
    if (defaultExpanded !== undefined) {
      setExpanded(defaultExpanded);
      return;
    }
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setExpanded(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [defaultExpanded]);

  const displayText = useMemo(() => {
    if (!text?.trim()) return null;
    return truncateToMaxWords(text.trim(), 60);
  }, [text]);

  if (isLoading) return <ExplanationSkeleton />;
  if (!displayText) return null;

  return (
    <div className="mt-3 rounded-xl border border-[#E8ECF4] bg-[#F8FAFC] px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Why this result?</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded ? (
        <p className="mt-2 text-xs leading-relaxed text-[#475569]">{displayText}</p>
      ) : null}
    </div>
  );
}

export function DataConfidenceBadge({ confidence }: { confidence?: string }) {
  if (!confidence || confidence === "verified") return null;
  const label =
    confidence === "unavailable"
      ? "Historical data not publicly available"
      : "Estimated from public signals";
  return (
    <span className="mt-1 inline-block rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#64748B]">
      {label}
    </span>
  );
}
