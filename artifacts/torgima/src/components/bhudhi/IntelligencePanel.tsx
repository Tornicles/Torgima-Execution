import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base";
import { apiPost } from "@/lib/torgima-api";
import { applyExecutionLanguage } from "@/lib/execution-language";
import { cn } from "@/lib/utils";

export interface IntelligencePanelProps {
  type: "briefing" | "report" | "explanation" | "warning" | "insight";
  content: string | Record<string, unknown>;
  title?: string;
  confidenceTier?: "HIGH" | "MEDIUM" | "LOW";
  userCondition?: string;
  expandable?: boolean;
  className?: string;
}

function contentToString(content: string | Record<string, unknown>): string {
  if (typeof content === "string") return content;
  if (typeof content.explanation === "string") return content.explanation;
  if (typeof content.interpretation === "string") return content.interpretation;
  if (typeof content.text === "string") return content.text;
  return applyExecutionLanguage("Execution intelligence for your active Blueprint.");
}

export function IntelligencePanel({
  type,
  content,
  title,
  confidenceTier = "MEDIUM",
  userCondition,
  expandable = false,
  className,
}: IntelligencePanelProps) {
  const [filtered, setFiltered] = useState<string | null>(null);
  const [uncertaintyNote, setUncertaintyNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!expandable);

  useEffect(() => {
    const raw = contentToString(content);
    if (!API_BASE_URL) {
      setFiltered(applyExecutionLanguage(raw));
      setUncertaintyNote(
        confidenceTier === "LOW" ?
          "This estimate is based on limited data and will improve with more execution."
        : null,
      );
      return;
    }

    void apiPost<{ content: string; uncertaintyNote?: string | null }>("/api/communication/filter", {
      content: raw,
      outputType: type,
      userCondition,
      confidenceTier,
    })
      .then((d) => {
        if (d?.content) {
          setFiltered(d.content);
          setUncertaintyNote(d.uncertaintyNote ?? null);
        } else {
          setFiltered(applyExecutionLanguage(raw));
        }
      })
      .catch(() => setFiltered(applyExecutionLanguage(raw)));
  }, [content, type, userCondition, confidenceTier]);

  const border =
    type === "warning" ? "border-amber-300 bg-amber-50"
    : type === "report" ? "border-gray-200 bg-white"
    : "border-gray-100 bg-gray-50";

  return (
    <section className={cn("rounded-2xl border p-5 space-y-3", border, className)}>
      {title && (
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {expandable && (
            <button
              type="button"
              className="text-xs text-green-700 font-medium"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
        </header>
      )}
      {expanded && (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {filtered ?? "Loading system intelligence…"}
        </p>
      )}
      {uncertaintyNote && (
        <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">{uncertaintyNote}</p>
      )}
    </section>
  );
}
