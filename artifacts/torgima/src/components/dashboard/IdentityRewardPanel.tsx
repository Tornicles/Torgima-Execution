import type { IdentitySnapshot, RewardSnapshot } from "@/types/dashboard";

export function IdentityRewardPanel({
  identity,
  reward,
  compact = false,
}: {
  identity?: IdentitySnapshot;
  reward?: RewardSnapshot;
  compact?: boolean;
}) {
  if (!identity && !reward) return null;

  return (
    <section
      className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}
      aria-label="Progress and reinforcement"
    >
      {identity ? (
        <div className="rounded-2xl border border-[#ECECF4] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Stage</p>
          <p className="mt-1 text-sm font-semibold text-[#0B1220]">{identity.label ?? identity.stage}</p>
          {identity.description ? (
            <p className="mt-1 text-xs text-[#64748B] line-clamp-2">{identity.description}</p>
          ) : null}
        </div>
      ) : null}
      {reward ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Momentum</p>
          <p className="mt-1 text-sm font-semibold text-violet-950">{reward.label ?? reward.type}</p>
          {reward.message ? (
            <p className="mt-1 text-xs text-violet-800 line-clamp-2">{reward.message}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
