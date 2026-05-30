import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  BlueprintSelectionPanel,
  type ModeId,
  type TierId,
} from "@/components/blueprint/BlueprintSelectionPanel";
import type { ValidationScreenData } from "@/components/validation/ValidationScreen";
import { OnboardingStructureStep } from "@/components/onboarding/OnboardingStructureStep";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import type { FlowStepId } from "@/components/onboarding/TopProgressRail";
import { ErectorOnboardingRefinementFlow } from "@/components/onboarding/ErectorOnboardingRefinementFlow";
import type { AlignedIntakeForm } from "@/components/onboarding/AlignedGoalIntake";
import { saveValidationFeed } from "@/lib/erector-refinement-api";
import { AlignedValidationResults } from "@/components/validation/AlignedValidationResults";
import {
  budgetNumber,
  timeframeForApi,
  type CommitmentKey,
  type ErectorIntakeForm,
} from "@/components/onboarding/erector-intake-types";
import { ApiError } from "@workspace/api-client-react";
import {
  apiFetchEnvelope,
  apiFetchResponseWithRetry,
  completeOnboarding,
  formatApiEnvelopeError,
  launchValidationBlueprint,
} from "@/lib/torgima-api";
import { buildOnboardingGoalPayload, validateIntakeBeforeSubmit } from "@/lib/onboarding-goal-payload";
import { postValidationRun, validationRunNavigatePath } from "@/lib/validation-run";
import { API_BASE_URL } from "@/lib/api-base";
import { ValidationStatus } from "@workspace/state-machine";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type ErectorReviewPhase = "briefing" | "scores" | "paths" | "blueprint";
function timeframeForGoalApi(form: ErectorIntakeForm): string {
  if (form.timeframeKey === "30d") return "30 days";
  if (form.timeframeKey === "90d") return "90 days";
  if (form.timeframeKey === "6m") return "6 months";
  if (form.timeframeKey === "1yr") return "1 year";
  if (form.timeframeKey === "custom" && form.customTimeframeDays) return `${form.customTimeframeDays} days`;
  return "90 days";
}

function commitmentForGoalApi(level: CommitmentKey): "low" | "medium" | "high" | "full" {
  if (level === "LOW") return "low";
  if (level === "HIGH") return "high";
  if (level === "INTENSE") return "full";
  return "medium";
}

function combinedContext(form: ErectorIntakeForm): string {
  const tags = form.contextTags.length ? `\nContext: ${form.contextTags.join(", ")}` : "";
  const extra = form.additionalContext.trim() ? `\n${form.additionalContext.trim()}` : "";
  return `${form.currentContext.trim()}${tags}${extra}`.trim();
}

const ERECTOR_ENGINE_MESSAGES = [
  "Preparing reality analysis...",
  "Economy mapped â€” loading civilization intelligence...",
  "Understanding your goal and purpose...",
  "Analyzing industry conditions...",
  "Mapping market demand and competition...",
  "Identifying who is winning in this market...",
  "Building your economy intelligence report...",
  "Analyzing customer pain points...",
  "Calculating execution requirements...",
  "Simulating your execution timelines...",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ensure validationContractId is present (API may omit it on older poll payloads). */
async function resolveValidationContractId(
  payload: ValidationPayload,
): Promise<ValidationPayload> {
  if (payload.validationContractId || !payload.validationId) {
    return payload;
  }
  const res = await fetchWithRetry(`/api/validation/${payload.validationId}/status`, {
    credentials: "include",
  });
  const json = (await res.json()) as { ok?: boolean; data?: { validationContractId?: string } };
  if (json.ok && json.data?.validationContractId) {
    return { ...payload, validationContractId: json.data.validationContractId };
  }
  return payload;
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = 3): Promise<Response> {
  const url =
    typeof input === "string" ? input
    : input instanceof URL ? input.href
    : (input as Request).url;
  if (url.includes("/api/")) {
    return apiFetchResponseWithRetry(url, init, attempts);
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.status < 500 || attempt === attempts - 1) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1) throw err;
    }
    await sleep(500 * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

function isValidationPayloadReady(payload: ValidationPayload | null | undefined): boolean {
  if (!payload?.blueprintId) return false;
  const status = String(payload.status ?? "").toLowerCase();
  return (
    status === "validated" ||
    status === "complete" ||
    Boolean(payload.validationContractId) ||
    Boolean(payload.erectorValidationId)
  );
}

function normalizeValidationPayload(payload: ValidationPayload): ValidationPayload {
  return {
    ...payload,
    status: "validated",
  };
}

interface FormData extends ErectorIntakeForm {
  secondaryGoals: string;
  domain: string;
  specificTarget: string;
  purposeDeep: string;
  targetDate: string;
  hoursPerWeek: string;
  resources: string;
  experience: string;
  budget: string;
}

type ValidationPayload = ValidationScreenData & {
  status?: string;
  validationId?: string;
  canProceed?: boolean;
};

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [selectedPath, setSelectedPath] = useState<"current" | "adjusted" | "alternative">("current");
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null);
  const [selectedMode, setSelectedMode] = useState<ModeId | null>("individual");
  const [goalStructured, setGoalStructured] = useState(false);
  const [refinementBlueprintId, setRefinementBlueprintId] = useState<string | null>(null);
  const [refinementLocked, setRefinementLocked] = useState(false);
  const [feedReady, setFeedReady] = useState(false);
  const [finalGoalText, setFinalGoalText] = useState("");
  const [finalPurposeText, setFinalPurposeText] = useState("");
  const [pendingIntake, setPendingIntake] = useState<AlignedIntakeForm | null>(null);
  const [erectorPhase, setErectorPhase] = useState<ErectorReviewPhase>("briefing");
  const [pathConfirmed, setPathConfirmed] = useState(false);
  const [, setLocation] = useLocation();

  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const isSubmittingRef = useRef(false);

  const [form, setForm] = useState<FormData>({
    primaryGoal: "",
    purpose: "",
    timeframeKey: "90d",
    customTimeframeDays: undefined,
    commitmentLevel: "MEDIUM",
    desiredOutcome: "",
    locationCountry: "",
    locationCity: "",
    businessType: "online",
    businessModel: "",
    currentContext: "",
    currency: "USD",
    budgetAvailable: "",
    currentResources: [],
    targetCustomer: "",
    successSignal: "",
    contextTags: [],
    knownBlockers: [],
    additionalContext: "",
    domain: "business",
    secondaryGoals: "",
    specificTarget: "",
    purposeDeep: "",
    targetDate: "",
    hoursPerWeek: "",
    resources: "",
    experience: "",
    budget: "",
  });

  function setField<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function toggleResource(resource: string) {
    setForm((p) => ({
      ...p,
      currentResources: p.currentResources.includes(resource)
        ? p.currentResources.filter((item) => item !== resource)
        : [...p.currentResources, resource],
    }));
  }

  function toggleContextTag(tag: string) {
    setForm((p) => ({
      ...p,
      contextTags: p.contextTags.includes(tag) ? p.contextTags.filter((t) => t !== tag) : [...p.contextTags, tag],
    }));
  }

  function addBlocker(text: string) {
    setForm((p) => ({ ...p, knownBlockers: [...p.knownBlockers, text] }));
  }

  function removeBlocker(index: number) {
    setForm((p) => ({ ...p, knownBlockers: p.knownBlockers.filter((_, i) => i !== index) }));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("id") ?? params.get("validationId");
    if (queryId) {
      void loadValidationResults(queryId);
      return;
    }
    const pendingId = sessionStorage.getItem("torgima_validation_results");
    if (!pendingId) return;
    sessionStorage.removeItem("torgima_validation_results");
    void loadValidationResults(pendingId);
  }, []);

  useEffect(() => {
    if (step === 7 && erectorPhase === "blueprint" && !isValidationPayloadReady(validation)) {
      setStep(1);
      setErectorPhase("briefing");
    }
  }, [step, erectorPhase, validation]);

  async function loadValidationResults(validationId: string) {
    setLoading(true);
    setError("");
    setStep(7);
    try {
      const polled = await pollValidationUntilReady(validationId);
      if (!polled) {
        setError("Could not load validation results.");
        return;
      }
      const resultRes = await fetchWithRetry(`/api/validation/${validationId}/result`, {
        credentials: "include",
      });
      const resultJson = (await resultRes.json()) as { ok?: boolean; data?: ValidationPayload };
      let payload = resultJson.ok && resultJson.data ? normalizeValidationPayload(resultJson.data) : polled;
      const runEnvelope = await apiFetchEnvelope<Record<string, unknown>>(`/api/v1/validation/${validationId}`);
      if (runEnvelope.ok && runEnvelope.data) {
        const erectorResult = runEnvelope.data;
        payload = normalizeValidationPayload({
          ...payload,
          erectorValidationId: validationId,
          validationContractId: String(
            erectorResult.validationContractId ?? erectorResult.contract_id ?? payload.validationContractId ?? "",
          ),
          intelligence: { ...(payload.intelligence ?? {}), erector: erectorResult },
          verdict: String(erectorResult.verdict ?? payload.verdict),
          paths: (erectorResult.paths as ValidationPayload["paths"]) ?? payload.paths,
        });
      }
      setValidation(payload);
      setErectorPhase("scores");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load validation.");
    } finally {
      setLoading(false);
    }
  }

  function deriveTimeframeKey(startDate: string, endDate: string): { key: FormData["timeframeKey"]; days?: number } {
    const days = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 3600 * 1000),
    );
    if (days <= 45) return { key: "30d" };
    if (days <= 120) return { key: "90d" };
    if (days <= 200) return { key: "6m" };
    if (days <= 400) return { key: "1yr" };
    return { key: "custom", days };
  }

  async function handleAlignedStart(intake: AlignedIntakeForm) {
    if (isSubmittingRef.current) return;
    const intakeError = validateIntakeBeforeSubmit(intake);
    if (intakeError) {
      setError(intakeError);
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError("");

    const tf = deriveTimeframeKey(intake.startDate, intake.endDate);

    setForm((f) => ({
      ...f,
      primaryGoal: intake.rawGoal,
      purpose: intake.purpose,
      locationCountry: intake.locationCountry,
      businessModel: intake.businessModel,
      commitmentLevel: intake.commitmentLevel,
      desiredOutcome: intake.purpose,
      timeframeKey: tf.key,
      customTimeframeDays: tf.days,
    }));

    try {
      const goalEnvelope = await apiFetchEnvelope<ValidationPayload>(`/api/onboarding/goal`, {
        method: "POST",
        body: JSON.stringify(
          buildOnboardingGoalPayload(intake, {
            idempotencyKey: idempotencyKeyRef.current,
            tier: selectedTier ?? "starter",
            mode: selectedMode ?? "individual",
          }),
        ),
      });
      if (!goalEnvelope.ok || !goalEnvelope.data?.blueprintId) {
        setError(formatApiEnvelopeError(goalEnvelope, "Could not start validation."));
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }
      const blueprintId = goalEnvelope.data.blueprintId;
      setRefinementBlueprintId(blueprintId);
      setPendingIntake(intake);
      isSubmittingRef.current = false;
      setLoading(false);
      return;
    } catch (err) {
      console.error("Validation error:", err);
      setError("Connection failed. Check your internet and try again.");
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }

  async function runValidationAfterRefinement(
    blueprintId: string,
    intake: AlignedIntakeForm,
    goalFinal: string,
    purposeFinal: string,
  ) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError("");

    const tf = deriveTimeframeKey(intake.startDate, intake.endDate);
    const timeframe = tf.key === "custom" && tf.days ? "custom" : tf.key;

    try {
      await saveValidationFeed(blueprintId, {
        goal_final: goalFinal,
        purpose_final: purposeFinal,
        country: intake.locationCountry || "United States",
        business_type: intake.businessModel || "Other",
        business_model: intake.businessModel || "Other",
        commitment_level: intake.commitmentLevel || "HIGH",
        budget: 0,
        resources: [],
        target_customer: intake.locationCountry ? `Users in ${intake.locationCountry}` : "Early adopters",
        timeframe: { duration_days: tf.days ?? 90 },
      });

      const runResult = await postValidationRun({
        blueprintId,
        idempotency_key: idempotencyKeyRef.current,
        idempotencyKey: idempotencyKeyRef.current,
        rawGoal: intake.rawGoal,
        purpose: purposeFinal,
        timeframe: timeframe || "1yr",
        customTimeframeDays: tf.days,
        commitmentLevel: intake.commitmentLevel || "HIGH",
        locationCountry: intake.locationCountry || "United States",
        businessModel: intake.businessModel || "Other",
        businessType: "online",
        budgetAvailable: 0,
        currency: "USD",
        currentResources: [],
        targetCustomer: "",
        desiredOutcome: purposeFinal,
        currentContext: "",
        knownBlockers: [],
        tier: selectedTier ?? "starter",
        mode: selectedMode ?? "individual",
      });

      if (!runResult.ok || !runResult.validationId) {
        setError(runResult.errorMessage ?? "Validation failed.");
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }

      sessionStorage.setItem("torgima_validation_results", runResult.validationId);
      setLocation(validationRunNavigatePath(runResult.validationId, runResult.redirectTo));
      return;
    } catch (err) {
      console.error("Validation error:", err);
      setError("Connection failed. Check your internet and try again.");
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }

  function canContinue(): boolean {
    if (step <= 5) return true;
    if (step === 6) return goalStructured;
    return true;
  }

  async function saveBlueprintSelection(blueprintId: string): Promise<boolean> {
    if (!selectedTier || !selectedMode) {
      setError("Select a blueprint tier and mode before continuing.");
      return false;
    }
    const res = await apiFetchResponseWithRetry(`/api/blueprints/${blueprintId}/configure-selection`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: selectedTier, mode: selectedMode }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
    if (!data.ok) {
      setError(data.error?.message ?? "Could not save blueprint selection.");
      return false;
    }
    return true;
  }

  async function handleNext() {
    if (step < 5) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    if (step === 5) {
      setStep(6);
      return;
    }
    if (step === 6) {
      setStep(7);
      await handleValidate();
    }
  }

  function applyTimelineProgress(
    events: Array<{ stage?: string; status?: string }>,
  ): void {
    const map: Record<string, ValidationStatus> = {};
    for (const ev of events) {
      if (!ev.stage || ev.stage === "COMPLETE") continue;
      map[ev.stage] =
        ev.status === "COMPLETED" ? ValidationStatus.COMPLETE
        : ev.status === "RUNNING" ? ValidationStatus.RUNNING
        : ValidationStatus.PENDING;
    }
    if (Object.keys(map).length === 0) return;
    setValidation((prev) =>
      prev
        ? { ...prev, systemsProgress: { ...prev.systemsProgress, ...map } }
        : { systemsProgress: map },
    );
  }

  async function pollValidationUntilReady(validationId: string): Promise<ValidationPayload | null> {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      const [statusRes, timelineRes] = await Promise.all([
        fetchWithRetry(`/api/validation/${validationId}/status`, { credentials: "include" }),
        fetchWithRetry(`/api/validation/${validationId}/timeline`, { credentials: "include" }),
      ]);
      const timelineJson = (await timelineRes.json()) as {
        ok?: boolean;
        data?: { events?: Array<{ stage?: string; status?: string }> };
      };
      if (timelineJson.ok && timelineJson.data?.events) {
        applyTimelineProgress(timelineJson.data.events);
      }
      const statusJson = (await statusRes.json()) as {
        ok?: boolean;
        data?: { status?: string; verdict?: string };
      };
      const sessionStatus = statusJson.data?.status;
      if (sessionStatus === ValidationStatus.COMPLETE || sessionStatus === "validated") {
        const resultRes = await fetchWithRetry(`/api/validation/${validationId}/result`, {
          credentials: "include",
        });
        const resultJson = (await resultRes.json()) as { ok?: boolean; data?: ValidationPayload };
        if (resultJson.ok && resultJson.data) return resultJson.data;
        return null;
      }
      if (sessionStatus === ValidationStatus.FAILED || sessionStatus === "invalid") return null;
      await sleep(1500);
    }
    return null;
  }

  async function handleValidate() {
    setLoading(true);
    setError("");
    setValidation(null);
    console.log("[VALIDATION_START]", {
      goal: form.primaryGoal.slice(0, 80),
      timeframe: timeframeForGoalApi(form),
      tier: selectedTier,
      mode: selectedMode,
    });
    try {
      const tf = timeframeForApi(form);
      const goalEnvelope = await apiFetchEnvelope<ValidationPayload>(`/api/onboarding/goal`, {
        method: "POST",
        body: JSON.stringify({
          rawGoal: form.primaryGoal,
          purpose: form.purpose,
          timeframe: timeframeForGoalApi(form),
          commitmentLevel: commitmentForGoalApi(form.commitmentLevel),
          currentContext: combinedContext(form),
          successSignal: form.successSignal || form.specificTarget || undefined,
          knownBlockers: form.knownBlockers.length ? form.knownBlockers.join(", ") : undefined,
          domain: form.domain,
          domainHints: form.domain ? [form.domain, ...form.contextTags] : form.contextTags,
          idempotencyKey: idempotencyKeyRef.current,
          tier: selectedTier ?? "starter",
          mode: selectedMode ?? "individual",
        }),
      });
      console.log("[GOAL_RESPONSE]", {
        ok: goalEnvelope.ok,
        status: goalEnvelope.status,
        data: goalEnvelope.data,
        error: goalEnvelope.error,
      });
      if (!goalEnvelope.ok || !goalEnvelope.data) {
        setError(formatApiEnvelopeError(goalEnvelope, "Validation failed."));
        return;
      }
      const d = goalEnvelope.data;
      let payload: ValidationPayload | null = d;
      if (d.validationId && !d.blueprintId && String(d.status ?? "").toLowerCase() !== "validated") {
        const polled = await pollValidationUntilReady(d.validationId);
        if (polled) payload = normalizeValidationPayload({ ...polled, status: polled.status ?? "validated" });
        else {
          setError("Validation is taking longer than expected. Try again in a moment.");
          return;
        }
      }

      if (isValidationPayloadReady(payload)) {
        payload = await resolveValidationContractId(payload!);
        const runEnvelope = await apiFetchEnvelope<Record<string, unknown>>(`/api/v1/validation/run`, {
          method: "POST",
          body: JSON.stringify({
            blueprintId: payload!.blueprintId,
            idempotencyKey: `erector-${payload!.blueprintId}-${idempotencyKeyRef.current}`,
            rawGoal: form.primaryGoal,
            purpose: form.purpose,
            ...tf,
            commitmentLevel: form.commitmentLevel,
            desiredOutcome: form.desiredOutcome,
            location: { country: form.locationCountry, city: form.locationCity || undefined },
            businessType: form.businessType,
            businessModel: form.businessModel,
            budgetAvailable: budgetNumber(form),
            currency: form.currency,
            currentResources: form.currentResources,
            targetCustomer: form.targetCustomer,
            knownBlockers: form.knownBlockers.length ? form.knownBlockers : undefined,
            successSignal: form.successSignal || form.specificTarget || undefined,
            currentContext: combinedContext(form),
            domainHint: form.domain,
            tier: selectedTier ?? "starter",
            mode: selectedMode ?? "individual",
          }),
        });
        console.log("[RUN_RESPONSE]", {
          ok: runEnvelope.ok,
          status: runEnvelope.status,
          data: runEnvelope.data,
          error: runEnvelope.error,
        });
        if (!runEnvelope.ok || !runEnvelope.data) {
          setError(runEnvelope.error?.message ?? "Erector validation failed.");
          return;
        }
        const runData = runEnvelope.data;
        const runSuccess = runData.success === true || runData.validationId != null;
        if (!runSuccess) {
          setError(String(runData.error ?? "Validation failed"));
          console.error("[VALIDATION_ERROR]", runData);
          return;
        }
        const erectorResult = (runData.result ?? runData) as Record<string, unknown>;
        const erectorVerdict = String(runData.verdict ?? erectorResult.verdict ?? "");
        payload = normalizeValidationPayload({
          ...payload!,
          erectorValidationId: String(runData.validationId ?? erectorResult.validationId ?? ""),
          erectorValidationContractId: String(
            runData.validationContractId ?? erectorResult.validationContractId ?? "",
          ),
          verdict: (erectorVerdict as ValidationPayload["verdict"]) || payload!.verdict,
          launchBlocked: erectorVerdict === "pivot" || erectorVerdict === "blocked",
          paths: (erectorResult.paths as ValidationPayload["paths"]) ?? payload!.paths,
          intelligence: { ...(payload!.intelligence ?? {}), erector: erectorResult },
        });
        if (!payload.blueprintId) {
          setError("Validation did not return a blueprint id.");
          return;
        }
        const resultsPath =
          String(runData.redirectTo ?? runData.redirect_to ?? "") ||
          `/onboarding?id=${payload.erectorValidationId ?? runData.validationId ?? ""}`;
        console.log("[VALIDATION_NAVIGATE]", {
          to: resultsPath,
          erectorPhase: "scores",
          validationId: payload.erectorValidationId,
        });
        setValidation(payload);
        setErectorPhase("scores");
        setStep(7);
        if (resultsPath.startsWith("/onboarding")) {
          setLocation(resultsPath);
        }
        setPathConfirmed(false);
      } else if (payload?.status === "needs_clarification") {
        setError("We need a bit more detail. Go back and fill in missing fields, then try again.");
      } else if (d.status === "invalid") {
        setError("Your goal could not be validated. Refine it on earlier steps and try again.");
      } else {
        console.error("[VALIDATION_ERROR]", { payload, goalStatus: d.status });
        setError("Validation did not complete. Try again.");
      }
    } catch (err) {
      console.error("[VALIDATION_ERROR]", err);
      setError(err instanceof ApiError ? err.message : "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!validation?.blueprintId || !selectedTier || !selectedMode) return;
    const launchValidation = await resolveValidationContractId(validation);
    const validationId =
      launchValidation.erectorValidationId ?? launchValidation.validationId ?? "";
    if (!validationId) {
      setError("Validation id is missing. Re-run validation before launch.");
      return;
    }
    if (!launchValidation.blueprintId) {
      setError("Blueprint draft is missing. Re-run validation before launch.");
      return;
    }
    if (validation.verdict === "blocked") {
      setError("Reality Score is too low to launch. Re-validate with a more feasible goal.");
      return;
    }
    if ((validation.launchBlocked || validation.verdict === "pivot") && selectedPath !== "alternative") {
      setError("This validation requires the alternative path before launch.");
      return;
    }
    if (launching) return;

    const launchUrl = `${API_BASE_URL}/api/v1/validations/${validationId}/launch`;
    const selectedDirection = {
      path: selectedPath,
      tier: selectedTier,
      mode: selectedMode,
    };

    setLaunching(true);
    setError("");
    try {
      const saved = await saveBlueprintSelection(launchValidation.blueprintId);
      if (!saved) return;

      const erectorId = launchValidation.erectorValidationId ?? launchValidation.validationId;
      if (erectorId) {
        const pathRes = await fetchWithRetry(`/api/v1/validation/${erectorId}/select-path`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedPath }),
        });
        const pathData = (await pathRes.json()) as { ok?: boolean; error?: { message?: string } };
        if (!pathData.ok) {
          setError(pathData.error?.message ?? "Could not confirm path selection.");
          return;
        }
        await fetchWithRetry(`/api/v1/validation/${erectorId}/first-week`, {
          method: "POST",
          credentials: "include",
        });
      }

      const result = await launchValidationBlueprint(validationId, selectedDirection);

      await completeOnboarding();
      setLocation(result.redirectTo ?? result.redirect_to ?? "/dashboard");
    } catch (err) {
      const backendMessage =
        err instanceof ApiError && err.data && typeof err.data === "object"
          ? JSON.stringify(err.data)
          : err instanceof Error
            ? err.message
            : "Unknown error";
      const status = err instanceof ApiError ? err.status : "—";
      setError(
        [
          `Launch failed (HTTP ${status})`,
          `URL: ${launchUrl}`,
          `Validation id: ${validationId}`,
          `Selected direction: ${JSON.stringify(selectedDirection)}`,
          backendMessage,
        ].join("\n"),
      );
      console.error("[LAUNCH_BLUEPRINT]", { status, launchUrl, validationId, selectedDirection, err });
    } finally {
      setLaunching(false);
    }
  }

  const validated = isValidationPayloadReady(validation);

  useEffect(() => {
    if (step === 7 && erectorPhase === "blueprint" && validated && !validation?.verdict) {
      setStep(1);
      setErectorPhase("briefing");
      setLocation("/onboarding");
    }
  }, [step, erectorPhase, validated, validation?.verdict, setLocation]);

  const flowStep = useMemo((): FlowStepId => {
    if (step <= 5) return 1;
    if (step === 7 && erectorPhase === "blueprint") {
      return selectedTier && selectedMode ? 4 : 3;
    }
    if (step === 7) return 2;
    return 1;
  }, [step, erectorPhase, selectedTier, selectedMode]);

  const maxReachableStep = useMemo((): FlowStepId => {
    if (!validated) return 1;
    if (erectorPhase === "blueprint") return 3;
    return 2;
  }, [validated, erectorPhase]);

  function handleFlowStepClick(target: FlowStepId) {
    if (target === 1) {
      setStep(1);
      setErectorPhase("briefing");
      setLocation("/onboarding");
      return;
    }
    if (target === 2 && validated) {
      setStep(7);
      setErectorPhase("scores");
      return;
    }
    if (target === 3 && validated) {
      setStep(7);
      setErectorPhase("blueprint");
    }
  }

  if (step <= 5) {
    return (
      <ErectorOnboardingRefinementFlow
        idempotencyKey={idempotencyKeyRef.current}
        tier={selectedTier ?? "starter"}
        mode={selectedMode ?? "individual"}
        onValidationStarted={(validationId) => {
          sessionStorage.setItem("torgima_validation_results", validationId);
          setLocation(`/validation/${validationId}/results`);
        }}
      />
    );
  }

  return (
    <OnboardingShell flowStep={flowStep} maxReachableStep={maxReachableStep} onFlowStepClick={handleFlowStepClick}>
      <div className="max-w-5xl mx-auto px-6 py-8 w-full space-y-7">
            {step === 6 && !goalStructured && (
              <OnboardingStructureStep
                goal={form.primaryGoal}
                purpose={form.purpose}
                timeframe={timeframeForGoalApi(form)}
                commitmentLevel={commitmentForGoalApi(form.commitmentLevel)}
                domain={form.domain}
                onStructured={(refined) => {
                  setField("primaryGoal", refined);
                  setGoalStructured(true);
                }}
                onBack={() => setStep(5)}
              />
            )}

            {step === 6 && goalStructured && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 space-y-3">
                <h2 className="text-xl font-bold text-gray-900">Ready for validation</h2>
                <p className="text-sm text-gray-600">
                  The Erector will map your economy, score reality, and generate paths before you choose a blueprint tier.
                </p>
              </div>
            )}

            {step === 7 && (
              <>
                {loading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm">Running The Erector validation sequence...</p>
                    <div className="grid gap-2 w-full max-w-xl">
                      {ERECTOR_ENGINE_MESSAGES.map((message, index) => (
                        <div key={message} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-400">{index + 1}</span>
                          {message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!loading && !validation && !error && (
                  <div className="text-center py-16 space-y-4">
                    <p className="text-gray-500">Preparing your validation...</p>
                    <button type="button" onClick={handleValidate} className="text-green-600 underline text-sm">
                      Try again
                    </button>
                  </div>
                )}

                {!loading && error && !validation && (
                  <div className="text-center py-12 space-y-4">
                    <p className="text-red-600 text-sm">{error}</p>
                    <button type="button" onClick={() => { setError(""); setStep(6); }} className="text-green-600 underline text-sm">
                      â† Back to blueprint type
                    </button>
                  </div>
                )}

                {!loading && validated && validation && (
                  <>
                    {erectorPhase !== "blueprint" && (
                      <AlignedValidationResults
                        data={validation}
                        goalSummary={{
                          goal: form.primaryGoal,
                          purpose: form.purpose,
                          timeframe: timeframeForGoalApi(form),
                          locationCountry: form.locationCountry,
                          commitmentLevel: form.commitmentLevel,
                          businessModel: form.businessModel,
                        }}
                        onPathSelected={(path) => {
                          setSelectedPath(path);
                          setErectorPhase("blueprint");
                        }}
                      />
                    )}

                    {erectorPhase === "blueprint" && (
                      <BlueprintSelectionPanel
                        selectedTier={selectedTier}
                        selectedMode={selectedMode}
                        onTierChange={setSelectedTier}
                        onModeChange={setSelectedMode}
                        disabled={loading}
                      />
                    )}

                    {erectorPhase === "blueprint" && (
                      <button
                        type="button"
                        onClick={() => void handleLaunch()}
                        disabled={launching || loading || !selectedTier || !selectedMode}
                        className="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl hover:bg-gray-800 disabled:opacity-40 text-sm"
                      >
                        {launching ? "Launching Blueprint…" : "Launch blueprint"}
                      </button>
                    )}

                    {error && <p className="text-red-500 text-sm">{error}</p>}
                  </>
                )}
              </>
            )}
      </div>
    </OnboardingShell>
  );
}
/* TRUNCATE_MARKER */
