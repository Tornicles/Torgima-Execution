import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base";

interface InfrastructureView {
  operationalState: string;
  tier: string;
  mode: string;
  featureManifest: {
    lockedSystems: string[];
    allowedSystems: string[];
    intelligenceDepth: string;
  };
  rhythm: { cadence: string; intensity: string };
  graph: { nodes: Array<{ layer: string; label: string; risk: string }> };
}

export function BlueprintCivilizationStrip({ blueprintId }: { blueprintId: string }) {
  const [data, setData] = useState<InfrastructureView | null>(null);

  useEffect(() => {
    if (!API_BASE_URL || !blueprintId) return;
    void fetch(`${API_BASE_URL}/api/blueprints/${blueprintId}/infrastructure`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((body: { ok?: boolean; data?: InfrastructureView }) => {
        if (body.ok && body.data) setData(body.data);
      })
      .catch(() => null);
  }, [blueprintId]);

  if (!data) return null;

  const highRisk = data.graph.nodes.filter((n) => n.risk === "high").length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Execution civilization</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-900 text-white">
          {data.operationalState}
        </span>
        <span className="text-xs text-slate-600">Cadence: {data.rhythm.cadence}</span>
        <span className="text-xs text-slate-600">Intensity: {data.rhythm.intensity}</span>
        {highRisk > 0 && (
          <span className="text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md ring-1 ring-amber-200">
            {highRisk} high-risk nodes
          </span>
        )}
      </div>
      {data.featureManifest.lockedSystems.length > 0 && (
        <p className="text-xs text-slate-500">
          Locked at {data.tier} tier: {data.featureManifest.lockedSystems.slice(0, 4).join(", ")}
          {data.featureManifest.lockedSystems.length > 4 ? "…" : ""}
        </p>
      )}
    </section>
  );
}
