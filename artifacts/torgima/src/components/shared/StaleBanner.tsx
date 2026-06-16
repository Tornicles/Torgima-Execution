import { Loader2 } from "lucide-react";
import { STALE_BANNER_MESSAGE, useStaleStateStore } from "@/lib/state-version";

/** DOC 31 — shown while dashboard refetches after STALE_STATE. */
export function StaleBanner() {
  const visible = useStaleStateStore((s) => s.visible);
  const refreshing = useStaleStateStore((s) => s.refreshing);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900"
    >
      {refreshing ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : null}
      <span>{STALE_BANNER_MESSAGE}</span>
    </div>
  );
}
