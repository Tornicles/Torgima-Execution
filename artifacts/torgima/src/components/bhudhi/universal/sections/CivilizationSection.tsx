import { useCallback, useEffect, useState } from "react";
import {
  createIntelligenceCivilization,
  fetchIntelligenceCivilizations,
} from "@/lib/intelligence-bridge";
import {
  fetchCivilizationForecast,
  fetchCivilizationResilience,
  simulateCivilizationYears,
} from "@/lib/bhudhi-civilization-api";

export function CivilizationSection({ blueprintId }: { blueprintId: string }) {
  const [civilization, setCivilization] = useState<Record<string, unknown> | null>(null);
  const [civilizations, setCivilizations] = useState<
    Array<{
      id: string;
      name: string;
      population: number;
      institutions: number;
      resilience: number;
      trajectory: string;
    }>
  >([]);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [resilience, setResilience] = useState<Record<string, unknown> | null>(null);
  const [series, setSeries] = useState<Array<Record<string, unknown>>>([]);
  const [inflectionPoints, setInflectionPoints] = useState<
    Array<{ year: number; from: string; to: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchIntelligenceCivilizations(blueprintId);
      setCivilizations(list.civilizations);

      const created = await createIntelligenceCivilization(blueprintId);
      setCivilization(created.civilization);

      const f = await fetchCivilizationForecast(blueprintId);
      setForecast(f.forecast);

      const r = await fetchCivilizationResilience(blueprintId);
      setResilience(r.resilience);

      const sim = await simulateCivilizationYears(blueprintId, 20);
      setSeries(sim.series);
      setInflectionPoints(sim.inflectionPoints);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load civilization intelligence");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void load();
  }, [load]);

  const horizons = (forecast?.horizons as Array<Record<string, unknown>>) ?? [];
  const stressTests =
    (resilience?.stressTests as Array<{ name: string; impact: number }>) ?? [];

  if (loading && !civilization) {
    return <p className="text-sm text-gray-500">Loading civilization intelligence…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-2">Civilization Intelligence</h1>
          <p className="text-gray-600 text-sm max-w-xl">
            Model civilizations as living systems — population, institutions, economy, ecosystem,
            and 1–100 year forecasts. Advisory only; never governs execution reality.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-sm underline text-gray-600"
        >
          {loading ? "Observing…" : "Refresh observation"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      {civilization && (
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Current state</p>
          <p className="text-2xl font-light capitalize">
            {String(civilization.evolutionMode)} · {String(civilization.trajectory)}
          </p>
          <p className="text-sm text-gray-600 mt-2">{String(civilization.recommendation ?? "")}</p>
        </div>
      )}

      {civilizations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {civilizations.map((civ) => (
            <div key={civ.id} className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-medium">{civ.name}</h3>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                <li>Population index: {(civ.population / 1000).toFixed(1)}k</li>
                <li>Institutions: {civ.institutions}</li>
                <li className="capitalize">Trajectory: {civ.trajectory}</li>
                <li>Resilience: {Math.round(civ.resilience * 100)}%</li>
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="border border-gray-200 rounded-lg p-5">
          <h2 className="text-lg font-medium mb-3">Long-horizon forecast</h2>
          <ul className="text-sm space-y-1">
            {horizons.map((h) => (
              <li key={String(h.horizonYears)} className="flex justify-between">
                <span>{String(h.horizonYears)} years</span>
                <span className="text-gray-500 capitalize">
                  {String(h.trajectory)} · {Math.round((h.confidence as number) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-gray-200 rounded-lg p-5">
          <h2 className="text-lg font-medium mb-3">Resilience & stress tests</h2>
          <p className="text-2xl font-light mb-2">
            {(resilience?.resilienceScore as number) ?? "—"}/100
          </p>
          <ul className="text-xs text-gray-600 space-y-1">
            {stressTests.map((s) => (
              <li key={s.name}>
                {s.name}: impact {(s.impact * 100).toFixed(0)}%
              </li>
            ))}
          </ul>
        </div>
      </div>

      {series.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">20-year simulation</h2>
          <div className="h-40 bg-white rounded flex items-end gap-0.5 p-3">
            {series.slice(0, 20).map((point, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-600 min-w-[4px]"
                style={{ height: `${Math.round((point.resilience as number) * 100)}%` }}
                title={`Year ${String(point.year)}`}
              />
            ))}
          </div>
          {inflectionPoints.length > 0 && (
            <ul className="text-sm text-gray-700 mt-4 space-y-1">
              {inflectionPoints.map((p) => (
                <li key={`${p.year}-${p.to}`}>
                  Year {p.year}: {p.from} → {p.to}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
