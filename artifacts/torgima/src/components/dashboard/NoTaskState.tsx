import { LANGUAGE } from "@/lib/language";
import { RefreshButton } from "./RefreshButton";

export function NoTaskState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <section className="rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center">
      <div
        className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent"
        aria-hidden
      />
      <p className="mt-4 text-sm text-[#64748B]">{LANGUAGE.dashboard.noTaskYet}</p>
      <div className="mt-4 flex justify-center">
        <RefreshButton onRefresh={onRefresh} />
      </div>
    </section>
  );
}
