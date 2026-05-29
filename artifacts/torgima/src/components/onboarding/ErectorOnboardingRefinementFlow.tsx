import { useCallback, useEffect, useState } from "react";
import { understandGoal, understandPurpose } from "@/lib/erector-refinement-api";
import {
  buildErectorValidationPayload,
  validateErectorContext,
  type ErectorContextForm,
} from "@/lib/onboarding-goal-payload";
import {
  apiFetchEnvelope,
  formatApiEnvelopeError,
} from "@/lib/torgima-api";
import { postValidationRun } from "@/lib/validation-run";
import type { CommitmentKey } from "./erector-intake-types";
import {
  initialErectorOnboardingState,
  loadPersistedErectorOnboarding,
  persistErectorOnboarding,
  type ErectorOnboardingState,
  type ErectorOnboardingStep,
} from "@/lib/erector-onboarding-flow";

const TIMEFRAME_DAYS = [
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
  { label: "180 days", days: 180 },
] as const;

const COMMITMENT_OPTIONS: { key: CommitmentKey; label: string }[] = [
  { key: "LOW", label: "Low" },
  { key: "MEDIUM", label: "Medium" },
  { key: "HIGH", label: "High" },
  { key: "INTENSE", label: "Intense" },
];

const DOMAIN_OPTIONS = [
  "SaaS",
  "Education",
  "Coaching",
  "Online Services",
  "Ecommerce",
  "Content",
  "Consulting",
  "Marketplace",
  "Local Business",
  "Other",
];

function fieldErrorsToMessage(fieldErrors?: Record<string, string[]>): string {
  if (!fieldErrors) return "Invalid input.";
  return Object.entries(fieldErrors)
    .flatMap(([field, msgs]) => msgs.map((m) => `${field}: ${m}`))
    .join(" ");
}

export function ErectorOnboardingRefinementFlow({
  idempotencyKey,
  tier = "starter",
  mode = "individual",
  onValidationStarted,
}: {
  idempotencyKey: string;
  tier?: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
  onValidationStarted: (validationId: string) => void;
}) {
  const [flow, setFlow] = useState<ErectorOnboardingState>(() => {
    return loadPersistedErectorOnboarding() ?? initialErectorOnboardingState();
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [contextForm, setContextForm] = useState<ErectorContextForm>({
    location: "",
    domain: "SaaS",
    commitment: "MEDIUM",
    currentContext: "",
    timeframeDays: 90,
    pace: "moderate",
  });

  const persist = useCallback((next: ErectorOnboardingState) => {
    setFlow(next);
    persistErectorOnboarding(next);
  }, []);

  useEffect(() => {
    persistErectorOnboarding(flow);
  }, [flow]);

  async function submitRawGoal() {
    const raw = flow.rawGoal.trim();
    if (!raw) {
      setFieldErrors({ rawGoal: "Enter your goal." });
      return;
    }
    setLoading(true);
    setError("");
    setFieldErrors({});
    const res = await understandGoal(raw);
    setLoading(false);
    if (!res.ok || !res.data?.options?.length) {
      setError(formatApiEnvelopeError(res, fieldErrorsToMessage(res.error?.fieldErrors)));
      return;
    }
    const options = res.data.options.slice(0, 3);
    if (options.length < 3) {
      setError("Goal refinement did not return enough options. Try again.");
      return;
    }
    persist({
      ...flow,
      rawGoal: raw,
      goalOptions: options,
      step: "goal_options",
    });
  }

  function selectGoal(option: string) {
    persist({
      ...flow,
      selectedGoal: option,
      step: "raw_purpose",
    });
  }

  async function submitRawPurpose() {
    const raw = flow.rawPurpose.trim();
    if (!raw) {
      setFieldErrors({ rawPurpose: "Enter your purpose." });
      return;
    }
    if (!flow.selectedGoal.trim()) {
      setError("Select a refined goal first.");
      return;
    }
    setLoading(true);
    setError("");
    setFieldErrors({});
    const res = await understandPurpose(raw, flow.selectedGoal);
    setLoading(false);
    if (!res.ok || !res.data?.options?.length) {
      setError(formatApiEnvelopeError(res, fieldErrorsToMessage(res.error?.fieldErrors)));
      return;
    }
    const options = res.data.options.slice(0, 3);
    if (options.length < 3) {
      setError("Purpose refinement did not return enough options. Try again.");
      return;
    }
    persist({
      ...flow,
      rawPurpose: raw,
      purposeOptions: options,
      step: "purpose_options",
    });
  }

  function selectPurpose(option: string) {
    persist({
      ...flow,
      selectedPurpose: option,
      step: "context",
    });
  }

  const canStartValidation =
    Boolean(flow.selectedGoal.trim()) &&
    Boolean(flow.selectedPurpose.trim()) &&
    Object.keys(validateErectorContext(contextForm)).length === 0;

  async function startValidation() {
    const ctxErrors = validateErectorContext(contextForm);
    if (Object.keys(ctxErrors).length > 0) {
      setFieldErrors(ctxErrors);
      return;
    }
    if (!flow.selectedGoal.trim() || !flow.selectedPurpose.trim()) {
      setError("Select refined goal and purpose before validating.");
      return;
    }

    setLoading(true);
    setError("");
    setFieldErrors({});
    persist({ ...flow, step: "validating" });

    const payload = buildErectorValidationPayload(
      {
        rawGoal: flow.rawGoal,
        selectedGoal: flow.selectedGoal,
        rawPurpose: flow.rawPurpose,
        selectedPurpose: flow.selectedPurpose,
        context: contextForm,
      },
      { idempotencyKey, tier, mode },
    );

    try {
      const goalEnvelope = await apiFetchEnvelope<{ blueprintId: string }>("/api/onboarding/goal", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!goalEnvelope.ok || !goalEnvelope.data?.blueprintId) {
        setError(formatApiEnvelopeError(goalEnvelope, "Could not start validation."));
        persist({ ...flow, step: "context" });
        setLoading(false);
        return;
      }

      const blueprintId = goalEnvelope.data.blueprintId;
      const runResult = await postValidationRun({
        blueprintId,
        idempotency_key: idempotencyKey,
        idempotencyKey,
        rawGoal: flow.rawGoal,
        goal: flow.selectedGoal,
        purpose: flow.selectedPurpose,
        timeframe: `${contextForm.timeframeDays} days`,
        customTimeframeDays: contextForm.timeframeDays,
        commitmentLevel: contextForm.commitment,
        locationCountry: contextForm.location,
        businessModel: contextForm.domain,
        businessType: "online",
        currentContext: contextForm.currentContext,
        tier,
        mode,
      });

      if (!runResult.ok || !runResult.validationId) {
        setError(runResult.errorMessage ?? "Validation failed.");
        persist({ ...flow, step: "context" });
        setLoading(false);
        return;
      }

      persist({ ...flow, step: "results" });
      onValidationStarted(runResult.validationId);
    } catch (err) {
      console.error("[ErectorOnboarding] validation error:", err);
      setError(err instanceof Error ? err.message : "Validation failed.");
      persist({ ...flow, step: "context" });
    } finally {
      setLoading(false);
    }
  }

  function goBack(target: ErectorOnboardingStep) {
    setError("");
    setFieldErrors({});
    persist({ ...flow, step: target });
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6 max-w-2xl mx-auto">
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {flow.step === "raw_goal" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">What do you want to build?</h2>
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={flow.rawGoal}
            onChange={(e) => persist({ ...flow, rawGoal: e.target.value })}
            placeholder="I want to build a platform that helps founders execute ideas"
          />
          {fieldErrors.rawGoal ? <p className="text-sm text-destructive">{fieldErrors.rawGoal}</p> : null}
          <button
            type="button"
            disabled={loading || !flow.rawGoal.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void submitRawGoal()}
          >
            {loading ? "Submitting…" : "Submit Goal"}
          </button>
        </div>
      )}

      {flow.step === "goal_options" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Choose the clearest version of your goal</h2>
          {flow.goalOptions.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={loading}
              className="block w-full rounded-md border border-border p-3 text-left text-sm hover:border-primary"
              onClick={() => selectGoal(opt)}
            >
              {opt}
            </button>
          ))}
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => goBack("raw_goal")}>
            ← Edit raw goal
          </button>
        </div>
      )}

      {flow.step === "raw_purpose" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Why do you want to build this?</h2>
          <p className="text-xs text-muted-foreground">Selected goal: {flow.selectedGoal}</p>
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={flow.rawPurpose}
            onChange={(e) => persist({ ...flow, rawPurpose: e.target.value })}
            placeholder="I want to help people turn ideas into daily progress"
          />
          {fieldErrors.rawPurpose ? <p className="text-sm text-destructive">{fieldErrors.rawPurpose}</p> : null}
          <button
            type="button"
            disabled={loading || !flow.rawPurpose.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void submitRawPurpose()}
          >
            {loading ? "Submitting…" : "Submit Purpose"}
          </button>
        </div>
      )}

      {flow.step === "purpose_options" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Choose the clearest version of your purpose</h2>
          {flow.purposeOptions.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={loading}
              className="block w-full rounded-md border border-border p-3 text-left text-sm hover:border-primary"
              onClick={() => selectPurpose(opt)}
            >
              {opt}
            </button>
          ))}
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => goBack("raw_purpose")}>
            ← Edit raw purpose
          </button>
        </div>
      )}

      {flow.step === "context" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Context & timeframe</h2>
          <p className="text-xs text-muted-foreground">
            Goal: {flow.selectedGoal}
            <br />
            Purpose: {flow.selectedPurpose}
          </p>

          <label className="block text-sm font-medium">
            Location
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contextForm.location}
              onChange={(e) => setContextForm((c) => ({ ...c, location: e.target.value }))}
              placeholder="United States"
            />
          </label>
          {fieldErrors.location ? <p className="text-sm text-destructive">{fieldErrors.location}</p> : null}

          <label className="block text-sm font-medium">
            Timeframe
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contextForm.timeframeDays}
              onChange={(e) =>
                setContextForm((c) => ({ ...c, timeframeDays: Number(e.target.value) }))
              }
            >
              {TIMEFRAME_DAYS.map((t) => (
                <option key={t.days} value={t.days}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Commitment level
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contextForm.commitment}
              onChange={(e) =>
                setContextForm((c) => ({ ...c, commitment: e.target.value as CommitmentKey }))
              }
            >
              {COMMITMENT_OPTIONS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Domain / business type
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contextForm.domain}
              onChange={(e) => setContextForm((c) => ({ ...c, domain: e.target.value }))}
            >
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            What is involved in this business? (optional)
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contextForm.currentContext}
              onChange={(e) => setContextForm((c) => ({ ...c, currentContext: e.target.value }))}
            />
          </label>

          <button
            type="button"
            disabled={loading || !canStartValidation}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void startValidation()}
          >
            Start Validation
          </button>
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => goBack("purpose_options")}>
            ← Change purpose
          </button>
        </div>
      )}

      {flow.step === "validating" && (
        <div className="flex flex-col items-center py-12 gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Bhudhi is validating your idea...</p>
        </div>
      )}
    </div>
  );
}
