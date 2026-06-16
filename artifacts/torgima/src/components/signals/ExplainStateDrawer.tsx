import { useEffect, useRef, useState } from "react";
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
  const [failed, setFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !blueprintId) return;
    let cancelled = false;
    setExplaining(true);
    setExplanation(null);
    setFailed(false);
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
        setFailed(true);
        setExplanation(LANGUAGE.signalsPanel.explainUnavailable);
      }
      setExplaining(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, blueprintId, subject, signalKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-white rounded-t-2xl shadow-xl p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 id="explain-drawer-title" className="text-lg font-bold text-gray-900">
            {LANGUAGE.signalsPanel.explain}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {explaining ? (
          <div className="flex items-center gap-2 text-sm text-gray-600 py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            {LANGUAGE.states.processing}
          </div>
        ) : failed ? (
          <p className="text-sm text-amber-800" role="alert">
            {LANGUAGE.signalsPanel.explainError}
          </p>
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
