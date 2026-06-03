import { Lock } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import { RefreshButton } from "./RefreshButton";

/** DOC 33 — safe lock/repair surface; no internal errors. */
export function HealthLockState({
  reason,
  onRefresh,
}: {
  reason?: string;
  onRefresh: () => void;
}) {
  return (
    <div
      className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-12 text-center"
      role="alert"
    >
      <Lock className="h-10 w-10 text-amber-600" aria-hidden />
      <h2 className="mt-4 text-xl font-bold text-[#0B1220]">{LANGUAGE.dashboard.lockTitle}</h2>
      <p className="mt-3 text-sm text-[#64748B]">
        {reason ?? LANGUAGE.dashboard.lockBody}
      </p>
      <p className="mt-2 text-xs text-[#94A3B8]">{LANGUAGE.dashboard.lockHint}</p>
      <div className="mt-6">
        <RefreshButton onRefresh={onRefresh} />
      </div>
    </div>
  );
}
