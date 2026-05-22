import { useState } from "react";
import { structureGoal } from "@/lib/torgima-api";

export function OnboardingStructureStep({
  goal,
  purpose,
  timeframe,
  commitmentLevel,
  domain,
  onStructured,
  onBack,
}: {
  goal: string;
  purpose: string;
  timeframe: string;
  commitmentLevel: string;
  domain: string;
  onStructured: (refinedGoal: string) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refined, setRefined] = useState<string | null>(null);
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  async function runStructure() {
    setLoading(true);
    setError("");
    try {
      const payload = (await structureGoal({
        rawGoal: goal,
        purpose,
        timeframe,
        commitmentLevel,
        domainHints: domain ? [domain] : undefined,
      })) as {
        cleanedGoal?: string;
        structured_goal?: { cleanedGoal?: string };
        missingFields?: string[];
        clarificationQuestions?: string[];
        validation_status?: string;
      };
      const cleaned =
        payload?.cleanedGoal ??
        payload?.structured_goal?.cleanedGoal ??
        goal;
      setRefined(cleaned);
      const questions = payload?.clarificationQuestions ?? payload?.missingFields ?? [];
      setClarifications(questions.map(String));
      if (questions.length === 0 || payload?.validation_status === "VALID_DRAFT") {
        onStructured(cleaned);
      }
    } catch {
      setError("Cannot reach structuring service");
    } finally {
      setLoading(false);
    }
  }

  function submitClarifications() {
    const merged = `${refined ?? goal}\n${Object.values(answers).join("\n")}`.trim();
    onStructured(merged);
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Refine your goal</h2>
        <p className="text-sm text-gray-500 mt-1">Bhudhi structures intent into an execution-ready draft.</p>
      </div>

      {!refined && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void runStructure()}
          className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? "Structuring…" : "Structure goal with Bhudhi"}
        </button>
      )}

      {refined && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-bold uppercase text-green-800 mb-1">Execution version</p>
          <p className="text-sm text-green-950">{refined}</p>
        </div>
      )}

      {clarifications.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-800">Clarifications needed</p>
          {clarifications.map((q, i) => (
            <div key={q}>
              <p className="text-xs text-gray-600 mb-1">{q}</p>
              <input
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
          <button type="button" onClick={submitClarifications} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold">
            Continue with clarifications
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="button" onClick={onBack} className="text-sm text-gray-500 underline">
        ← Back
      </button>
    </div>
  );
}
