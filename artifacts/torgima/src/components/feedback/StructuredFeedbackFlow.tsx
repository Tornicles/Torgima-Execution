import { useEffect, useState } from "react";
import {
  startStructuredFeedback,
  submitStructuredFeedback,
  type TaskRealityState,
} from "@/lib/structured-feedback-api";

const DAILY_REALITY = [
  { id: "worked_assigned", label: "Worked on assigned work" },
  { id: "worked_other", label: "Worked on something else" },
  { id: "learned", label: "Learned something" },
  { id: "solved_problem", label: "Solved a problem" },
  { id: "rested", label: "Rested" },
  { id: "nothing_significant", label: "Nothing significant" },
] as const;

const EMOTIONS = [
  "Focused",
  "Good",
  "Tired",
  "Stressed",
  "Confused",
  "Distracted",
  "Excited",
  "Overwhelmed",
  "Calm",
] as const;

const FRICTIONS = [
  { id: "not_enough_time", label: "Not enough time" },
  { id: "low_energy", label: "Low energy" },
  { id: "task_too_hard", label: "Task too hard" },
  { id: "confusing_unclear", label: "Confusing / unclear" },
  { id: "tool_tech_issue", label: "Tool / tech issue" },
  { id: "waiting_on_something", label: "Waiting on something" },
  { id: "fear_hesitation", label: "Fear / hesitation" },
  { id: "nothing_blocked", label: "Nothing blocked me" },
] as const;

const OUTPUTS = [
  { id: "created", label: "Created something new" },
  { id: "published", label: "Published / shipped" },
  { id: "improved", label: "Improved something" },
  { id: "learned", label: "Learned something" },
  { id: "fixed", label: "Fixed a problem" },
  { id: "no_tangible_output", label: "No tangible output" },
] as const;

const TASK_STATES: TaskRealityState[] = [
  "Finished",
  "Partly Done",
  "Started",
  "Not Started",
  "Blocked",
  "Skipped",
];

type Step = "a" | "b" | "c" | "d" | "e" | "f";

export function StructuredFeedbackFlow({
  blueprintId,
  onComplete,
  onSkip,
}: {
  blueprintId: string;
  onComplete?: (message: string) => void;
  onSkip?: () => void;
}) {
  const [step, setStep] = useState<Step>("a");
  const [sessionId, setSessionId] = useState("");
  const [orders, setOrders] = useState<Array<{ id: string; title: string }>>([]);
  const [showReflection, setShowReflection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [dailyReality, setDailyReality] = useState<string[]>([]);
  const [realitySummary, setRealitySummary] = useState("");
  const [taskStates, setTaskStates] = useState<Record<string, TaskRealityState>>({});
  const [emotions, setEmotions] = useState<string[]>([]);
  const [frictions, setFrictions] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [reflection, setReflection] = useState<"yes_fine" | "no_change" | "help_understand" | "">("");

  useEffect(() => {
    void startStructuredFeedback(blueprintId, "app_open").then((res) => {
      setLoading(false);
      if (!res.ok || !res.data) {
        setError(res.error?.message ?? "Could not start feedback");
        return;
      }
      if (res.data.route === "show_dashboard" || res.data.route === "show_progress") {
        onSkip?.();
        return;
      }
      if (res.data.session) {
        setSessionId(res.data.session.id);
        setShowReflection(res.data.session.showReflectionSection);
      }
      setOrders(res.data.unfinishedOrders ?? []);
      const initial: Record<string, TaskRealityState> = {};
      for (const o of res.data.unfinishedOrders ?? []) {
        initial[o.id] = "Not Started";
      }
      setTaskStates(initial);
    });
  }, [blueprintId, onSkip]);

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function handleSubmit() {
    if (!sessionId) return;
    setSubmitting(true);
    setError("");
    const res = await submitStructuredFeedback({
      sessionId,
      dailyReality,
      realitySummary: realitySummary.trim() || undefined,
      taskStates: Object.entries(taskStates).map(([task_id, state]) => ({ task_id, state })),
      emotionalState: emotions,
      frictionType: frictions,
      outputType: outputs,
      reflectionSignal: reflection || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Submit failed");
      return;
    }
    onComplete?.(res.data?.message ?? "Feedback recorded. Your blueprint is adapting.");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading today&apos;s reality check…</p>;
  }

  if (!sessionId && !error) return null;

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">What actually happened today?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Describe reality — no scores. The system interprets and adapts.
        </p>
      </div>

      {step === "a" && (
        <section className="space-y-4">
          <p className="text-sm font-medium">What did you actually do today?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {DAILY_REALITY.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dailyReality.includes(o.id)}
                  onChange={() => toggle(dailyReality, o.id, setDailyReality)}
                />
                {o.label}
              </label>
            ))}
          </div>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px]"
            placeholder="Tell me briefly what happened."
            value={realitySummary}
            onChange={(e) => setRealitySummary(e.target.value)}
          />
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => setStep("b")}>
            Continue
          </button>
        </section>
      )}

      {step === "b" && (
        <section className="space-y-4">
          <p className="text-sm font-medium">What happened with each task?</p>
          {orders.map((o) => (
            <div key={o.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-2">{o.title}</p>
              <div className="flex flex-wrap gap-2">
                {TASK_STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`rounded-md px-2 py-1 text-xs border ${taskStates[o.id] === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => setTaskStates((prev) => ({ ...prev, [o.id]: s }))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => setStep("c")}>
            Continue
          </button>
        </section>
      )}

      {step === "c" && (
        <section className="space-y-4">
          <p className="text-sm font-medium">How did today feel?</p>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((e) => (
              <button
                key={e}
                type="button"
                className={`rounded-full px-3 py-1 text-xs border ${emotions.includes(e) ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => toggle(emotions, e, setEmotions)}
              >
                {e}
              </button>
            ))}
          </div>
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => setStep("d")}>
            Continue
          </button>
        </section>
      )}

      {step === "d" && (
        <section className="space-y-4">
          <p className="text-sm font-medium">What slowed you down?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FRICTIONS.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={frictions.includes(f.id)} onChange={() => toggle(frictions, f.id, setFrictions)} />
                {f.label}
              </label>
            ))}
          </div>
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => setStep("e")}>
            Continue
          </button>
        </section>
      )}

      {step === "e" && (
        <section className="space-y-4">
          <p className="text-sm font-medium">What came out of today?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OUTPUTS.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={outputs.includes(o.id)} onChange={() => toggle(outputs, o.id, setOutputs)} />
                {o.label}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => setStep(showReflection ? "f" : "f")}
          >
            {showReflection ? "Continue to reflection" : "Submit feedback"}
          </button>
          {!showReflection ? (
            <button
              type="button"
              disabled={submitting || emotions.length === 0 || frictions.length === 0 || outputs.length === 0}
              className="ml-2 rounded-md border px-4 py-2 text-sm"
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Submitting…" : "Submit now"}
            </button>
          ) : null}
        </section>
      )}

      {step === "f" && showReflection && (
        <section className="space-y-4">
          <p className="text-sm font-medium">If tomorrow looked exactly the same, would you be satisfied?</p>
          {(
            [
              ["yes_fine", "Yes, this is fine"],
              ["no_change", "No, need to change"],
              ["help_understand", "Help me understand"],
            ] as const
          ).map(([id, label]) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="reflection"
                checked={reflection === id}
                onChange={() => setReflection(id)}
              />
              {label}
            </label>
          ))}
          <button
            type="button"
            disabled={submitting || !reflection}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Submitting…" : "Submit feedback"}
          </button>
        </section>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
