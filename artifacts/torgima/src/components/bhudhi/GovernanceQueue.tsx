import { Link } from "wouter";

export interface GovernanceProposal {
  id: string;
  title?: string;
  rationale?: string;
}

export function GovernanceQueueAlert({
  count,
  proposals,
}: {
  count: number;
  proposals?: GovernanceProposal[];
}) {
  if (count <= 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      <p className="text-sm font-semibold text-amber-900">
        {count} governance proposal{count === 1 ? "" : "s"} awaiting review
      </p>
      {proposals?.slice(0, 2).map((p) => (
        <p key={p.id} className="text-xs text-amber-800 line-clamp-2">
          {p.title ?? p.rationale ?? "Blueprint adjustment proposed"}
        </p>
      ))}
      <Link href="/blueprint">
        <span className="text-xs font-semibold text-amber-900 underline cursor-pointer">Review in Blueprint</span>
      </Link>
    </div>
  );
}
