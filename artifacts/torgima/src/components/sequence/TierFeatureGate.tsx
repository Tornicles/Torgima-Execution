import type { ReactNode } from "react";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import { useTierSequenceStatus } from "@/hooks/useTierSequenceStatus";
import { buttons } from "@/design";

type Props = {
  children: ReactNode;
  required: "growth" | "ultimate";
  blueprintId?: string;
};

export function TierFeatureGate({ children, required, blueprintId }: Props) {
  const { data, loading, error } = useTierSequenceStatus(blueprintId);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">Checking tier access…</div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <p className="text-sm text-gray-600">{error ?? "Unable to verify access"}</p>
        <Link href="/dashboard">
          <span className={`mt-4 inline-block ${buttons.primary}`}>Back to dashboard</span>
        </Link>
      </div>
    );
  }

  const growthOk =
    data.features.interrogation?.available ||
    data.features.knowledge_cards?.available;
  const ultimateOk = data.features.predictions?.available;

  const allowed = required === "growth" ? growthOk : ultimateOk;
  if (allowed) return <>{children}</>;

  const reason =
    required === "growth"
      ? (data.features.interrogation?.reason ??
        "Growth Intelligence unlocks on Growth/Ultimate tier after Sequence 24 prerequisites.")
      : (data.features.predictions?.reason ??
        "Ultimate Intelligence requires Ultimate tier and Sequence 25.");

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center max-w-md mx-auto">
      <Lock className="w-10 h-10 text-gray-400 mb-4" />
      <h2 className="text-lg font-bold text-gray-900">Feature locked</h2>
      <p className="text-sm text-gray-500 mt-2">{reason}</p>
      <p className="text-xs text-gray-400 mt-4">
        {data.sequenceStatus.tier} · Sequence {data.sequenceStatus.currentSequence}/
        {data.sequenceStatus.totalSequences}
      </p>
      <Link href="/dashboard">
        <span className={`mt-6 inline-block ${buttons.primary}`}>View progress</span>
      </Link>
    </div>
  );
}
