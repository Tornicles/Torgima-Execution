import { useRef, useState } from "react";
import { useLocation } from "wouter";
import type { AlignedIntakeForm } from "@/components/onboarding/AlignedGoalIntake";
import { buildOnboardingGoalPayload, validateIntakeBeforeSubmit } from "@/lib/onboarding-goal-payload";
import { apiFetchEnvelope, formatApiEnvelopeError } from "@/lib/torgima-api";
import { postValidationRun, validationRunNavigatePath } from "@/lib/validation-run";

function deriveTimeframeKey(startDate: string, endDate: string): { key: string; days?: number } {
  const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 3600 * 1000));
  if (days <= 45) return { key: "30d" };
  if (days <= 120) return { key: "90d" };
  if (days <= 200) return { key: "6m" };
  if (days <= 400) return { key: "1yr" };
  return { key: "custom", days };
}

export function useValidationFlow() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const isSubmittingRef = useRef(false);

  async function startValidation(intake: AlignedIntakeForm) {
    if (isSubmittingRef.current) return;
    const intakeError = validateIntakeBeforeSubmit(intake);
    if (intakeError) {
      setError(intakeError);
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const goalEnvelope = await apiFetchEnvelope<{ blueprintId?: string }>(`/api/onboarding/goal`, {
        method: "POST",
        body: JSON.stringify(
          buildOnboardingGoalPayload(intake, { idempotencyKey: idempotencyKeyRef.current }),
        ),
      });

      if (!goalEnvelope.ok || !goalEnvelope.data?.blueprintId) {
        setError(formatApiEnvelopeError(goalEnvelope, "Could not start validation."));
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }

      const blueprintId = goalEnvelope.data.blueprintId;
      const tf = deriveTimeframeKey(intake.startDate, intake.endDate);
      const timeframe = tf.key === "custom" && tf.days ? "custom" : tf.key;

      const runResult = await postValidationRun({
        blueprintId,
        idempotency_key: idempotencyKeyRef.current,
        idempotencyKey: idempotencyKeyRef.current,
        rawGoal: intake.rawGoal,
        purpose: intake.purpose || intake.rawGoal,
        timeframe,
        customTimeframeDays: tf.days,
        commitmentLevel: intake.commitmentLevel || "HIGH",
        locationCountry: intake.locationCountry || "United States",
        businessModel: intake.businessModel || "Other",
        businessType: "online",
        budgetAvailable: 0,
        currency: "USD",
        currentResources: [],
        targetCustomer: "",
        desiredOutcome: intake.purpose || intake.rawGoal,
        currentContext: "",
        knownBlockers: [],
      });

      if (!runResult.ok || !runResult.validationId) {
        setError(runResult.errorMessage ?? "Validation failed.");
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }

      sessionStorage.setItem("torgima_validation_results", runResult.validationId);
      setLocation(validationRunNavigatePath(runResult.validationId, runResult.redirectTo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed.");
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }

  return { startValidation, loading, error, setError };
}
