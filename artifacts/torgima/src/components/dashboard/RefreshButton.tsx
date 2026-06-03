import { RefreshCw } from "lucide-react";
import { LANGUAGE } from "@/lib/language";

export function RefreshButton({ onRefresh, disabled }: { onRefresh: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRefresh}
      className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#5B21FF] hover:bg-[#F5F3FF] disabled:opacity-50"
    >
      <RefreshCw className="h-4 w-4" />
      {LANGUAGE.actions.refresh}
    </button>
  );
}
