import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { IntakeWizard } from "@/components/erector/IntakeWizard";
import { useOnboardingActiveBlueprintGuard } from "@/hooks/useOnboardingActiveBlueprintGuard";
import {
  captureHandoffTokenFromUrl,
  consumeHandoffToken,
  getPendingHandoffToken,
  getStoredHandoffPrefill,
  getStoredHandoffToken,
  shouldSkipIntake,
} from "@/lib/handoff-client";
import {
  submitIntakeSession,
  createIntakeSession,
  fetchIntakeSession,
  getStoredIntakeSessionId,
  saveIntakeSection,
  storeIntakeSessionId,
  type IntakeSession,
  type IntakeTier,
} from "@/lib/erector-intake-api";

async function applyPrefillToSession(
  sessionId: string,
  prefill: Record<string, unknown>,
): Promise<IntakeSession | null> {
  let current: IntakeSession | null = null;
  for (let section = 1; section <= 8; section += 1) {
    const key = `section_${section}_data`;
    const data = prefill[key];
    if (data && typeof data === "object" && Object.keys(data as object).length > 0) {
      current = await saveIntakeSection(sessionId, section, data as Record<string, unknown>);
    }
  }
  return current;
}

const LOADING_STEPS = [
  "Reviewing your 8-section intake",
  "Structuring goal and purpose",
  "Mapping market and revenue reality",
  "Preparing your validation report",
];

export default function OnboardingIntakePage() {
  useOnboardingActiveBlueprintGuard();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tierParam = params.get("tier") === "pro" ? "pro" : "authenticated";
  const sessionParam = params.get("session");
  const sectionParam = Number(params.get("section") ?? "0");

  const [session, setSession] = useState<IntakeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        captureHandoffTokenFromUrl();

        if (shouldSkipIntake()) {
          if (!cancelled) setLocation("/dashboard");
          return;
        }

        const pendingHandoff = getPendingHandoffToken();
        if (pendingHandoff) {
          try {
            const consumed = await consumeHandoffToken(pendingHandoff);
            if (!cancelled && consumed.intake_skip) {
              setLocation(consumed.redirect_to ?? "/dashboard");
              return;
            }
          } catch {
            // continue with stored prefill if consume already ran at signup
          }
        }

        if (sessionParam) {
          try {
            const linked = await fetchIntakeSession(sessionParam);
            storeIntakeSessionId(linked.id);
            if (!cancelled) {
              if (linked.status === "completed" && linked.validation_id) {
                setLocation(
                  linked.tier === "authenticated"
                    ? "/dashboard"
                    : `/onboarding/intake/report/${linked.validation_id}`,
                );
                return;
              }
              setSession(
                sectionParam >= 1 && sectionParam <= 8
                  ? { ...linked, current_section: sectionParam }
                  : linked,
              );
              setLoading(false);
              return;
            }
          } catch {
            // fall through to stored session
          }
        }

        const storedId = getStoredIntakeSessionId();
        if (storedId) {
          try {
            const existing = await fetchIntakeSession(storedId);
            if (!cancelled) {
              if (existing.status === "completed" && existing.validation_id) {
                setLocation(
                  existing.tier === "authenticated"
                    ? "/dashboard"
                    : `/onboarding/intake/report/${existing.validation_id}`,
                );
                return;
              }
              if (existing.prefilled_from_handoff) {
                setSession(existing);
                setLoading(false);
                return;
              }
              setSession(existing);
              setLoading(false);
              return;
            }
          } catch {
            // create fresh session below
          }
        }
        const handoffToken = getStoredHandoffToken() ?? getPendingHandoffToken() ?? undefined;
        const created = await createIntakeSession(tierParam as IntakeTier, handoffToken);
        const handoff = getStoredHandoffPrefill();
        const withPrefill =
          !created.prefilled_from_handoff &&
          handoff?.prefill &&
          Object.keys(handoff.prefill).length > 0
            ? (await applyPrefillToSession(created.id, handoff.prefill)) ?? created
            : created;
        if (!cancelled) {
          setSession(withPrefill);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to start intake session.");
          setLoading(false);
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setLocation, tierParam, sessionParam, sectionParam]);

  useEffect(() => {
    if (!analyzing) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setLoadingStep(Math.min(LOADING_STEPS.length - 1, Math.floor((Date.now() - started) / 3000)));
    }, 300);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  const handleComplete = useCallback(async () => {
    if (!session) return;
    setCompleting(true);
    setAnalyzing(true);
    setError(null);
    const minDelay = new Promise((resolve) => window.setTimeout(resolve, 4000));
    try {
      const [result] = await Promise.all([submitIntakeSession(session.id), minDelay]);
      const dest = result.redirect_to ?? (result.tier === "authenticated" ? "/dashboard" : `/onboarding/intake/report/${result.validation_id}`);
      setLocation(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis could not be completed.");
      setAnalyzing(false);
    } finally {
      setCompleting(false);
    }
  }, [session, setLocation]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Loading intake…</p>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        <h2 className="mt-6 text-2xl font-bold text-[#0A0F1E]">Analyzing your project</h2>
        <p className="mt-2 text-sm text-[#64748B]">{LOADING_STEPS[loadingStep]}</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-[#16A34A] px-5 py-3 text-sm font-semibold text-white"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      {error ? (
        <div className="mx-auto max-w-2xl px-6 pt-4">
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        </div>
      ) : null}
      <IntakeWizard
        session={session}
        onSessionUpdate={setSession}
        onComplete={() => void handleComplete()}
        completing={completing}
      />
    </>
  );
}
