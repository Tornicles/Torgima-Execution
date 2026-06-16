import { Link } from "wouter";
import { useIntelligenceDashboard, fetchIntelligenceModules } from "@/lib/intelligence-bridge";
import { INTELLIGENCE_COPY } from "@/lib/language-map";
import { useEffect, useState } from "react";

const DEEP_MODULES = [
  { label: "Economics", path: "economics" },
  { label: "Decision", path: "decision" },
  { label: "Beliefs", path: "beliefs" },
  { label: "World", path: "world" },
  { label: "Identity", path: "identity" },
  { label: "Organization", path: "organization" },
  { label: "Teams", path: "teams" },
  { label: "Experiments", path: "experiments" },
  { label: "Erector", path: "erector" },
  { label: "Civilization", path: "civilization" },
  { label: "Expansion", path: "expansion" },
  { label: "Temporal", path: "temporal" },
  { label: "Governor", path: "governor" },
  { label: "Reliability", path: "reliability" },
  { label: "Security engine", path: "security" },
  { label: "Infrastructure", path: "infrastructure" },
] as const;

const FIVE_SYSTEMS = [
  { id: "investigation", name: "Investigation", desc: "CIS · EIS · BIS" },
  { id: "intelligence", name: "Intelligence", desc: "IIS · SIS · PIS · KIS" },
  { id: "operating", name: "Operating", desc: "RIEZ · execution" },
  { id: "security", name: "Security", desc: "Validation & gates" },
  { id: "preservation", name: "Preservation", desc: "Learning & knowledge" },
] as const;

export function SystemsSection({ blueprintId }: { blueprintId: string }) {
  const { status, loading } = useIntelligenceDashboard(blueprintId);
  const [modules, setModules] = useState<Array<{ name: string; system: string; description: string }>>(
    [],
  );

  useEffect(() => {
    void fetchIntelligenceModules()
      .then((m) => setModules(m?.modules ?? []))
      .catch(() => setModules([]));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-light mb-2">Systems</h1>
        <p className="text-gray-600">{INTELLIGENCE_COPY.systemsHint}</p>
      </div>

      {loading && !status && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FIVE_SYSTEMS.map((sys) => {
          const active =
            status?.systems?.systems?.find((s) =>
              s.name.toLowerCase().includes(sys.id.slice(0, 4)),
            )?.status === "active";
          return (
            <div key={sys.id} className="border border-gray-200 rounded-lg p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium">{sys.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {active ? "active" : "—"}
                </span>
              </div>
              <p className="text-sm text-gray-600">{sys.desc}</p>
            </div>
          );
        })}
      </div>

      {status?.engines && (
        <div className="border border-gray-200 rounded-lg p-6 text-sm">
          <p>
            <span className="text-gray-600">Engines: </span>
            <span className="font-medium">
              {status.engines.active} / {status.engines.total} active
            </span>
          </p>
        </div>
      )}

      {modules.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">Registered modules ({modules.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-700">
            {modules.slice(0, 20).map((m) => (
              <div key={m.name} className="border border-gray-100 rounded p-2">
                <span className="font-medium">{m.name}</span>
                <span className="text-gray-500 block">{m.system}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium mb-3">Specialized engines</h2>
        <div className="flex flex-wrap gap-2">
          {DEEP_MODULES.map((m) => (
            <Link
              key={m.path}
              href={`/app/bhudhi/${m.path}?blueprintId=${encodeURIComponent(blueprintId)}`}
              className="text-sm border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-50"
            >
              {m.label}
            </Link>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Deep engine pages remain available; core workflow lives in this unified dashboard.
        </p>
      </div>
    </div>
  );
}
