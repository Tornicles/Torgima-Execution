import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { understandGoal, understandPurpose } from "@/lib/erector-refinement-api";
import {
  buildOnboardingGoalFlatPayload,
  validateErectorContext,
  type ErectorContextForm,
} from "@/lib/onboarding-goal-payload";
import {
  apiFetchEnvelope,
  formatApiEnvelopeError,
} from "@/lib/torgima-api";
import { postValidationRun } from "@/lib/validation-run";
import type { CommitmentKey } from "./erector-intake-types";
import { CountrySelector } from "./CountrySelector";
import { ErectorFlowShell } from "@/components/erector/ErectorFlowShell";
import { ValidationRunningDashboard } from "@/components/erector/ValidationRunningDashboard";
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

function commitmentLabel(key: CommitmentKey): string {
  return COMMITMENT_OPTIONS.find((c) => c.key === key)?.label ?? key;
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
  const [, setLocation] = useLocation();
  const [flow, setFlow] = useState<ErectorOnboardingState>(() => {
    return loadPersistedErectorOnboarding() ?? initialErectorOnboardingState();
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [contextForm, setContextForm] = useState<ErectorContextForm>({
    country: null,
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
    Boolean(contextForm.country?.countryName) &&
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

    setValidationError("");
    setError("");
    setFieldErrors({});
    persist({ ...flow, step: "validating" });

    const payload = buildOnboardingGoalFlatPayload(
      {
        selectedGoal: flow.selectedGoal,
        selectedPurpose: flow.selectedPurpose,
        context: contextForm,
      },
      { idempotencyKey },
    );

    try {
      const goalEnvelope = await apiFetchEnvelope<{ blueprintId: string }>("/api/onboarding/goal", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!goalEnvelope.ok || !goalEnvelope.data?.blueprintId) {
        const msg = formatApiEnvelopeError(goalEnvelope, "Could not start validation.");
        setValidationError(msg);
        persist({ ...flow, step: "context" });
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
        locationCountry: contextForm.country!.countryName,
        businessModel: contextForm.domain,
        businessType: "online",
        currentContext: contextForm.currentContext,
        tier,
        mode,
      });

      if (!runResult.ok || !runResult.validationId) {
        setValidationError(runResult.errorMessage ?? "Validation failed.");
        persist({ ...flow, step: "context" });
        return;
      }

      sessionStorage.setItem("torgima_validation_results", runResult.validationId);
      onValidationStarted(runResult.validationId);
      setLocation(`/validation/${runResult.validationId}/results`);
    } catch (err) {
      console.error("[ErectorOnboarding] validation error:", err);
      setValidationError(err instanceof Error ? err.message : "Validation failed.");
      persist({ ...flow, step: "context" });
    }
  }

  function goBack(target: ErectorOnboardingStep) {
    setError("");
    setFieldErrors({});
    persist({ ...flow, step: target });
  }

  if (flow.step === "validating") {
    return (
      <ValidationRunningDashboard
        context={{
          goal: flow.selectedGoal,
          purpose: flow.selectedPurpose,
          countryName: contextForm.country?.countryName ?? "",
          timeframeDays: contextForm.timeframeDays,
          commitmentLabel: commitmentLabel(contextForm.commitment),
          domain: contextForm.domain,
          currentContext: contextForm.currentContext,
        }}
        error={validationError}
        onRetry={() => {
          setValidationError("");
          void startValidation();
        }}
      />
    );
  }

  const shellTitle =
    flow.step === "raw_goal"
      ? "Validate New Idea"
      : flow.step === "raw_purpose"
        ? "Refine your purpose"
        : "Context & timeframe";

  return (
    <ErectorFlowShell title={shellTitle} subtitle="Erector refinement before reality validation">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
            <p>{error}</p>
            <button type="button" className="mt-2 text-xs underline" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        ) : null}

        {flow.step === "raw_goal" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">What do you want to build?</h2>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white"
              value={flow.rawGoal}
              onChange={(e) => persist({ ...flow, rawGoal: e.target.value })}
              placeholder="Describe your idea — we will polish spelling and grammar"
            />
            {fieldErrors.rawGoal ? <p className="text-sm text-red-400">{fieldErrors.rawGoal}</p> : null}
            <button
              type="button"
              disabled={loading || !flow.rawGoal.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void submitRawGoal()}
            >
              {loading ? "Submitting…" : "Submit Goal"}
            </button>
          </div>
        )}

        {flow.step === "goal_options" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Choose the clearest version of your goal</h2>
            {flow.goalOptions.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                className="block w-full rounded-lg border border-slate-600 bg-slate-800/50 p-4 text-left text-sm text-slate-100 hover:border-violet-500"
                onClick={() => selectGoal(opt)}
              >
                {opt}
              </button>
            ))}
            <button type="button" className="text-xs text-violet-400 underline" onClick={() => goBack("raw_goal")}>
              ← Edit raw goal
            </button>
          </div>
        )}

        {flow.step === "raw_purpose" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Why do you want to build this?</h2>
            <p className="text-xs text-slate-400">Selected goal: {flow.selectedGoal}</p>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white"
              value={flow.rawPurpose}
              onChange={(e) => persist({ ...flow, rawPurpose: e.target.value })}
              placeholder="Explain why this matters"
            />
            {fieldErrors.rawPurpose ? <p className="text-sm text-red-400">{fieldErrors.rawPurpose}</p> : null}
            <button
              type="button"
              disabled={loading || !flow.rawPurpose.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void submitRawPurpose()}
            >
              {loading ? "Submitting…" : "Submit Purpose"}
            </button>
          </div>
        )}

        {flow.step === "purpose_options" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Choose the clearest version of your purpose</h2>
            {flow.purposeOptions.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                className="block w-full rounded-lg border border-slate-600 bg-slate-800/50 p-4 text-left text-sm text-slate-100 hover:border-violet-500"
                onClick={() => selectPurpose(opt)}
              >
                {opt}
              </button>
            ))}
            <button type="button" className="text-xs text-violet-400 underline" onClick={() => goBack("raw_purpose")}>
              ← Edit raw purpose
            </button>
          </div>
        )}

        {flow.step === "context" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Context & timeframe</h2>
            <p className="text-xs text-slate-400">
              Goal: {flow.selectedGoal}
              <br />
              Purpose: {flow.selectedPurpose}
            </p>

            <CountrySelector
              value={contextForm.country}
              onChange={(country) => setContextForm((c) => ({ ...c, country }))}
              disabled={loading}
              error={fieldErrors.country}
            />

            <label className="block text-sm font-medium text-slate-200">
              Timeframe
              <select
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white"
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

            <label className="block text-sm font-medium text-slate-200">
              Commitment level
              <select
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white"
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

            <label className="block text-sm font-medium text-slate-200">
              Domain / business type
              <select
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white"
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

            <label className="block text-sm font-medium text-slate-200">
              What is involved in this business? (optional)
              <textarea
                className="mt-1 min-h-[80px] w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white"
                value={contextForm.currentContext}
                onChange={(e) => setContextForm((c) => ({ ...c, currentContext: e.target.value }))}
              />
            </label>

            <button
              type="button"
              disabled={loading || !canStartValidation}
              className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void startValidation()}
            >
              Start Validation
            </button>
            <button type="button" className="text-xs text-violet-400 underline" onClick={() => goBack("purpose_options")}>
              ← Change purpose
            </button>
          </div>
        )}
      </div>
    </ErectorFlowShell>
  );
}
