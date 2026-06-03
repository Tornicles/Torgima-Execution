import type { ProofType } from "@/types/task-execution";

export function ProofRequirement({
  proofType,
  instruction,
}: {
  proofType: ProofType;
  instruction: string;
}) {
  if (proofType === "NONE") return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider font-mono">
        Proof required · {proofType}
      </p>
      <p className="text-sm text-amber-900">{instruction}</p>
    </div>
  );
}
