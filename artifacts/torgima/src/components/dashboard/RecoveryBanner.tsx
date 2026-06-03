import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import type { RecoveryAlert } from "@/types/dashboard";

export function RecoveryBanner({ alert }: { alert: RecoveryAlert }) {
  return (
    <div
      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3"
      role="status"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-950">Recovery mode</p>
        <p className="text-sm text-amber-900 mt-0.5">{alert.message}</p>
        {alert.actionHref ? (
          <Link href={alert.actionHref}>
            <span className="mt-2 inline-block text-xs font-bold text-amber-800 underline cursor-pointer">
              Open recovery path →
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
