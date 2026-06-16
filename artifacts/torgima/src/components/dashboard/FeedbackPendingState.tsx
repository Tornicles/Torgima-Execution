import { Loader2 } from "lucide-react";
import { LANGUAGE } from "@/lib/language";

/** DOC 33 — after feedback submit while next order is generated. */
export function FeedbackPendingState() {
  return (
    <section
      className="rounded-2xl border border-[#ECECF4] bg-white px-6 py-8 text-center shadow-sm"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#5B21FF]" aria-hidden />
      <p className="mt-4 text-sm font-semibold text-[#0F172A]">
        Your next Order is being prepared.
      </p>
      <p className="mt-1 text-xs text-[#64748B]">{LANGUAGE.states.processing}</p>
    </section>
  );
}
