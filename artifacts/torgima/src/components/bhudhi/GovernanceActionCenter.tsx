import { API_BASE_URL } from "@/lib/api-base";

export interface GovernanceProposalVm {
  id: string;
  proposal_type?: string;
  rationale?: string;
  priority?: string;
  impact_assessment?: unknown;
}

export function GovernanceActionCenter({
  proposals,
  onChanged,
}: {
  proposals?: GovernanceProposalVm[];
  onChanged?: () => void;
}) {
  if (!proposals?.length) return null;

  async function submit(id: string, action: "approve" | "reject") {
    if (!API_BASE_URL) return;
    await fetch(`${API_BASE_URL}/api/governance/${id}/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason: "Dismissed from dashboard" }) : JSON.stringify({}),
    }).catch(() => null);
    onChanged?.();
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Governance action center</p>
      <div className="space-y-2">
        {proposals.map((p) => (
          <details key={p.id} className="rounded-xl bg-white border border-amber-100 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900">
              Blueprint restructure proposed · {p.priority ?? "NORMAL"}
            </summary>
            <p className="text-xs text-gray-600 mt-2">Evidence-based recommendation: {p.rationale}</p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => void submit(p.id, "approve")}
                className="text-xs font-semibold rounded-lg bg-amber-900 text-white px-3 py-2"
              >
                Execute proposal
              </button>
              <button
                type="button"
                onClick={() => void submit(p.id, "reject")}
                className="text-xs font-semibold rounded-lg bg-white border border-amber-200 text-amber-900 px-3 py-2"
              >
                Dismiss
              </button>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
