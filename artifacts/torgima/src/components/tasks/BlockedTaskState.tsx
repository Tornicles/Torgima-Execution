import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

export function BlockedTaskState({
  reason,
  onRefresh,
}: {
  reason?: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 flex gap-3">
        <AlertTriangle className="h-6 w-6 text-orange-700 shrink-0" aria-hidden />
        <div>
          <h2 className="text-lg font-bold text-orange-950">{LANGUAGE.task.blockedTitle}</h2>
          <p className="mt-2 text-sm text-orange-900">
            {reason ?? LANGUAGE.task.blockedHint}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {onRefresh ? <RefreshButton onRefresh={onRefresh} /> : null}
        <Link href="/dashboard">
          <span className="text-sm font-semibold text-[#5B21FF] underline cursor-pointer">
            {LANGUAGE.dashboard.title}
          </span>
        </Link>
      </div>
    </div>
  );
}
