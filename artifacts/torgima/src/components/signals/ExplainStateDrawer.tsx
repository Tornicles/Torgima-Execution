import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { postExplainState } from "@/api/bhudhi";
import { LANGUAGE } from "@/lib/language";

export function ExplainStateDrawer({
  open,
  onClose,
  subject,
  signalKey,
  blueprintId,
}: {
  open: boolean;
  onClose: () => void;
  subject: "condition" | "signal";
  signalKey?: string;
  blueprintId: string | null;
}) {
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !blueprintId) return;
    let cancelled = false;
    setExplaining(true);
    setExplanation(null);
    const focus = subject === "signal" && signalKey ? `signal:${signalKey}` : "condition";
    void postExplainState({ blueprintId, focus }).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data?.explanation) {
        const text =
          typeof res.data.explanation === "string"
            ? res.data.explanation
            : JSON.stringify(res.data.explanation);
        setExplanation(text.slice(0, 600));
      } else {
        setExplanation(LANGUAGE.signalsPanel.explainUnavailable);
      }
      setExplaining(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, blueprintId, subject, signalKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-lg bg-white rounded-t-2xl shadow-xl p-5 space-y-3 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{LANGUAGE.signalsPanel.explain}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {explaining ? (
          <div className="flex items-center gap-2 text-sm text-gray-600 py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            {LANGUAGE.states.processing}
          </div>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-bold"
        >
          {LANGUAGE.actions.back}
        </button>
      </div>
    </div>
  );
}
