import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base";

interface CharacterPayload {
  consistency?: number;
  grit?: number;
  discipline?: number;
  executionIntelligence?: number;
  adaptability?: number;
  overallCharacterScore?: number;
  characterLevel?: number;
}

export default function CharacterPage() {
  const [character, setCharacter] = useState<CharacterPayload | null>(null);
  const [identity, setIdentity] = useState<{
    stage?: string;
    purposeAlignment?: number;
    confidenceScore?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!API_BASE_URL) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/character/current`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; data?: { character?: CharacterPayload; identity?: typeof identity } }) => {
        if (d.ok && d.data) {
          setCharacter(d.data.character ?? null);
          setIdentity(d.data.identity ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const traits = [
    { key: "consistency", label: "Consistency" },
    { key: "grit", label: "Grit" },
    { key: "discipline", label: "Discipline" },
    { key: "executionIntelligence", label: "Execution intelligence" },
    { key: "adaptability", label: "Adaptability" },
  ] as const;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Character progression</h1>
        <p className="text-sm text-gray-500 mt-1">
          Five execution traits scored from real behavior — not self-report.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-gray-400">Loading character data…</p>
      ) : !character ? (
        <p className="text-sm text-gray-500">Execute more Orders to build your character profile.</p>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-xs font-bold uppercase text-gray-400">Character level</p>
            <p className="text-4xl font-bold text-gray-900 mt-1">{character.characterLevel ?? 1}</p>
            <p className="text-sm text-gray-500 mt-1">
              Overall score: {Math.round((character.overallCharacterScore ?? 0) * 100)}%
            </p>
          </div>

          <div className="space-y-3">
            {traits.map(({ key, label }) => {
              const value = character[key] ?? 0;
              const pct = Math.round(value * 100);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-green-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {identity ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm text-gray-700 space-y-1">
          <p>
            <span className="font-semibold">Identity stage:</span> {identity.stage}
          </p>
          <p>
            <span className="font-semibold">Purpose alignment:</span>{" "}
            {Math.round((identity.purposeAlignment ?? 0) * 100)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}
