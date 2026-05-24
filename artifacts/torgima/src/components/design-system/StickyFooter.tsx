import type { ReactNode } from "react";
import { Shield } from "lucide-react";

export function StickyFooter({
  message,
  action,
}: {
  message: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-900 font-medium">{message}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
