import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBhudhiBlueprint } from "@/hooks/useBhudhiBlueprint";
import { ConvergenceSection } from "@/components/bhudhi/universal/sections/ConvergenceSection";

/** Prompt 39 — dedicated Torgima ↔ Bhudhi convergence entry (alias of /app/bhudhi/convergence). */
export default function TorgimaBhudhiPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const blueprintId = useBhudhiBlueprint();

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 sm:p-10">
      <ConvergenceSection blueprintId={blueprintId} />
    </div>
  );
}
