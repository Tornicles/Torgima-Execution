import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { apiFetchEnvelope } from "@/lib/torgima-api";
import { ValidationStatus } from "@workspace/state-machine";

const MESSAGES = [
  "Preparing reality analysis…",
  "Mapping economy archetype…",
  "Analysing industry conditions…",
  "Running market and competitor intelligence…",
  "Generating paths and verdict…",
];

export default function ValidationRunningPage() {
  const [, params] = useRoute("/validation/:id/running");
  const [, setLocation] = useLocation();
  const validationId = params?.id ?? "";
  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!validationId) return;
    const tick = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 2500);
    return () => window.clearInterval(tick);
  }, [validationId]);

  useEffect(() => {
    if (!validationId) return;
    let cancelled = false;

    void (async () => {
      for (let attempt = 0; attempt < 90 && !cancelled; attempt++) {
        const statusEnvelope = await apiFetchEnvelope<{ status?: string }>(
          `/api/validation/${validationId}/status`,
        );
        const status = String(statusEnvelope.data?.status ?? "").toLowerCase();
        if (
          status === ValidationStatus.COMPLETE ||
          status === "validated" ||
          status === "complete"
        ) {
          sessionStorage.setItem("torgima_validation_results", validationId);
          setLocation(`/validation/${validationId}/results`);
          return;
        }
        if (status === ValidationStatus.FAILED || status === "invalid") {
          setError("Validation failed. Return to intake and try again.");
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled) {
        setError("Validation is taking longer than expected. You can return to onboarding and check status.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [validationId, setLocation]);

  return (
    <OnboardingShell flowStep={2} maxReachableStep={2}>
      <div className="max-w-lg mx-auto py-24 text-center space-y-6">
        <div className="w-12 h-12 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <h1 className="text-xl font-bold text-gray-900">Running validation</h1>
        <p className="text-sm text-gray-600">{MESSAGES[messageIndex]}</p>
        <p className="text-xs text-gray-400 font-mono">Session {validationId.slice(0, 24)}…</p>
        {error && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => setLocation("/onboarding")}
              className="text-violet-700 font-semibold text-sm underline"
            >
              Back to intake
            </button>
          </div>
        )}
      </div>
    </OnboardingShell>
  );
}
