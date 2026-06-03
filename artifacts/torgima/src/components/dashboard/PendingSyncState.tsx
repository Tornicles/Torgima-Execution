import { Loader2 } from "lucide-react";
import { LANGUAGE } from "@/lib/language";

/** DOC 33 — task guarantee pending; poll projection. */
export function PendingSyncState() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center bg-white p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-10 w-10 animate-spin text-[#5B21FF]" aria-hidden />
      <p className="mt-4 text-sm font-medium text-[#0B1220]">{LANGUAGE.dashboard.pendingTask}</p>
      <p className="mt-2 max-w-sm text-xs text-[#64748B]">{LANGUAGE.dashboard.pendingTaskHint}</p>
    </div>
  );
}
