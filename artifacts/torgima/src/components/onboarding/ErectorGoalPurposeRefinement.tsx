import { useState } from "react";
import {
  finalizeGoal,
  finalizePurpose,
  lockRefinement,
  selectGoalOption,
  selectPurposeOption,
  understandGoal,
  understandPurpose,
  type GoalUnderstanding,
  type PurposeUnderstanding,
} from "@/lib/erector-refinement-api";

type Phase = "raw_goal" | "goal_options" | "goal_edit" | "raw_purpose" | "purpose_options" | "purpose_edit" | "locked";

export function ErectorGoalPurposeRefinement({
  blueprintId,
  onLocked,
}: {
  blueprintId: string;
  onLocked: (goalFinal: string, purposeFinal: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("raw_goal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rawGoal, setRawGoal] = useState("");
  const [goalUnderstanding, setGoalUnderstanding] = useState<GoalUnderstanding | null>(null);
  const [goalOptions, setGoalOptions] = useState<string[]>([]);
  const [selectedGoalIdx, setSelectedGoalIdx] = useState<number | null>(null);
  const [goalFinal, setGoalFinal] = useState("");

  const [rawPurpose, setRawPurpose] = useState("");
  const [purposeUnderstanding, setPurposeUnderstanding] = useState<PurposeUnderstanding | null>(null);
  const [purposeOptions, setPurposeOptions] = useState<string[]>([]);
  const [selectedPurposeIdx, setSelectedPurposeIdx] = useState<number | null>(null);
  const [purposeFinal, setPurposeFinal] = useState("");

  async function runGoalUnderstand() {
    setLoading(true);
    setError("");
    const res = await understandGoal(blueprintId, rawGoal.trim());
    setLoading(false);
    if (!res.ok || !res.data) {
      setError(res.error?.message ?? "Could not analyze goal");
      return;
    }
    setGoalUnderstanding(res.data.understanding);
    setGoalOptions(res.data.options);
    setPhase("goal_options");
  }

  async function pickGoal(idx: number) {
    setLoading(true);
    const res = await selectGoalOption(blueprintId, idx);
    setLoading(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not select goal");
      return;
    }
    setSelectedGoalIdx(idx);
    setGoalFinal(res.data?.preview ?? goalOptions[idx] ?? "");
    setPhase("goal_edit");
  }

  async function commitGoal() {
    setLoading(true);
    const res = await finalizeGoal(blueprintId, goalFinal.trim());
    setLoading(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not lock goal");
      return;
    }
    setPhase("raw_purpose");
  }

  async function runPurposeUnderstand() {
    setLoading(true);
    setError("");
    const res = await understandPurpose(blueprintId, rawPurpose.trim());
    setLoading(false);
    if (!res.ok || !res.data) {
      setError(res.error?.message ?? "Could not analyze purpose");
      return;
    }
    setPurposeUnderstanding(res.data.understanding);
    setPurposeOptions(res.data.options);
    setPhase("purpose_options");
  }

  async function pickPurpose(idx: number) {
    setLoading(true);
    const res = await selectPurposeOption(blueprintId, idx);
    setLoading(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not select purpose");
      return;
    }
    setSelectedPurposeIdx(idx);
    setPurposeFinal(res.data?.preview ?? purposeOptions[idx] ?? "");
    setPhase("purpose_edit");
  }

  async function commitPurposeAndLock() {
    setLoading(true);
    const fin = await finalizePurpose(blueprintId, purposeFinal.trim());
    if (!fin.ok) {
      setLoading(false);
      setError(fin.error?.message ?? "Could not lock purpose");
      return;
    }
    const lock = await lockRefinement(blueprintId);
    setLoading(false);
    if (!lock.ok) {
      setError(lock.error?.message ?? "Could not finalize refinement");
      return;
    }
    setPhase("locked");
    onLocked(goalFinal.trim(), purposeFinal.trim());
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Refine your goal & purpose</h2>
        <p className="text-sm text-muted-foreground">
          Raw input is not the source of truth. Select and edit refined language before validation runs.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {phase === "raw_goal" && (
        <div className="space-y-3">
          <label className="text-sm font-medium">What do you want to build? (raw)</label>
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={rawGoal}
            onChange={(e) => setRawGoal(e.target.value)}
            placeholder="I want to create a fitness app"
          />
          <button
            type="button"
            disabled={loading || rawGoal.trim().length < 5}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void runGoalUnderstand()}
          >
            {loading ? "Analyzing…" : "Generate goal options"}
          </button>
        </div>
      )}

      {phase === "goal_options" && goalUnderstanding && (
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p>
              <strong>Object:</strong> {goalUnderstanding.object}
            </p>
            <p>
              <strong>Domain:</strong> {goalUnderstanding.domain}
            </p>
            {goalUnderstanding.unclear?.length ? (
              <p>
                <strong>Unclear:</strong> {goalUnderstanding.unclear.join(", ")}
              </p>
            ) : null}
          </div>
          <p className="text-sm font-medium">Choose one goal direction</p>
          {goalOptions.map((opt, i) => (
            <button
              key={i}
              type="button"
              className="block w-full rounded-md border border-border p-3 text-left text-sm hover:border-primary"
              onClick={() => void pickGoal(i)}
            >
              <span className="font-medium">Option {i + 1}</span>
              <p className="mt-1 text-muted-foreground">{opt}</p>
            </button>
          ))}
        </div>
      )}

      {phase === "goal_edit" && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Edit your final goal</label>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={goalFinal}
            onChange={(e) => setGoalFinal(e.target.value)}
          />
          <button
            type="button"
            disabled={loading || goalFinal.trim().length < 10}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void commitGoal()}
          >
            Lock goal
          </button>
        </div>
      )}

      {phase === "raw_purpose" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Goal locked. Now refine purpose.</p>
          <label className="text-sm font-medium">Why does this matter? (raw)</label>
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={rawPurpose}
            onChange={(e) => setRawPurpose(e.target.value)}
            placeholder="I want to help Africans stay fit"
          />
          <button
            type="button"
            disabled={loading || rawPurpose.trim().length < 5}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void runPurposeUnderstand()}
          >
            {loading ? "Analyzing…" : "Generate purpose options"}
          </button>
        </div>
      )}

      {phase === "purpose_options" && purposeUnderstanding && (
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p>
              <strong>Problem:</strong> {purposeUnderstanding.problem}
            </p>
            <p>
              <strong>Change:</strong> {purposeUnderstanding.change}
            </p>
          </div>
          {purposeOptions.map((opt, i) => (
            <button
              key={i}
              type="button"
              className="block w-full rounded-md border border-border p-3 text-left text-sm hover:border-primary"
              onClick={() => void pickPurpose(i)}
            >
              <span className="font-medium">Option {i + 1}</span>
              <p className="mt-1 text-muted-foreground">{opt}</p>
            </button>
          ))}
        </div>
      )}

      {phase === "purpose_edit" && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Edit your final purpose</label>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={purposeFinal}
            onChange={(e) => setPurposeFinal(e.target.value)}
          />
          <button
            type="button"
            disabled={loading || purposeFinal.trim().length < 10}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void commitPurposeAndLock()}
          >
            Lock purpose & continue
          </button>
        </div>
      )}

      {phase === "locked" && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 p-4 text-sm">
          <p className="font-medium">Refinement complete</p>
          <p className="mt-2 text-muted-foreground">These feed Erector validation and blueprint creation unchanged.</p>
        </div>
      )}
    </div>
  );
}
