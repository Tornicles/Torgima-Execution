import { X } from "lucide-react";
import type { BhudhiExplainResponse } from "@/lib/bhudhi-hub-types";

const PURPLE = "#5B21FF";

export function BhudhiExplainDrawer({
  open,
  onClose,
  loading,
  data,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  data: BhudhiExplainResponse | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#0F172A]">
            {loading ? "Bhudhi is reading your system…" : data?.explanation.title ?? "Explanation"}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close panel">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-20 bg-gray-100 rounded" />
              <div className="h-20 bg-gray-100 rounded" />
            </div>
          )}
          {!loading && data && (
            <>
              {data.explanation.sections.map((s) => (
                <div key={s.heading}>
                  <p className="text-xs font-bold uppercase text-[#64748B] mb-1">{s.heading}</p>
                  <p className="text-sm text-[#334155] leading-relaxed">{s.body}</p>
                </div>
              ))}
              {data.aiEnrichment && typeof data.aiEnrichment === "object" && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-sm text-[#334155]">
                  <p className="text-xs font-bold text-violet-700 mb-1">Extended intelligence</p>
                  <pre className="whitespace-pre-wrap text-xs font-sans">
                    {JSON.stringify(data.aiEnrichment, null, 2).slice(0, 1200)}
                  </pre>
                </div>
              )}
              <p className="text-[10px] text-[#94A3B8]">
                Confidence {Math.round(data.explanation.confidence * 100)}%
                {data.fallbackUsed ? " · grounded in system facts" : " · Bhudhi enrichment applied"}
              </p>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 text-xs text-center font-medium" style={{ color: PURPLE }}>
          {data?.principle ?? "Bhudhi explains. You decide. You execute."}
        </div>
      </aside>
    </div>
  );
}
