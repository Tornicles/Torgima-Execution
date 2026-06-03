import { Link } from "wouter";
import { Link2 } from "lucide-react";
import type { DependencyAlert } from "@/types/dashboard";

export function DependencyBanner({ alert }: { alert: DependencyAlert }) {
  return (
    <div
      className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3"
      role="status"
    >
      <Link2 className="h-5 w-5 shrink-0 text-orange-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-orange-950">Blocked</p>
        <p className="text-sm text-orange-900 mt-0.5">{alert.message}</p>
        {alert.actionHref ? (
          <Link href={alert.actionHref}>
            <span className="mt-2 inline-block text-xs font-bold text-orange-800 underline cursor-pointer">
              {alert.actionLabel ?? "Resolve blocker →"}
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
