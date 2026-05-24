import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ShieldCheck, Target } from "lucide-react";
import {
  BlueprintSelectionPanel,
  type ModeId,
  type TierId,
} from "@/components/blueprint/BlueprintSelectionPanel";
import { ValidationScreen, type ValidationScreenData } from "@/components/validation/ValidationScreen";
import {
  buildErectorValidationReport,
  ErectorScoresDashboard,
} from "@/components/validation/ErectorScoresDashboard";
import { FirstWeekPlanPanel } from "@/components/validation/FirstWeekPlanPanel";
import type { PathKey } from "@/components/validation/PathPanels";
import { OnboardingStructureStep } from "@/components/onboarding/OnboardingStructureStep";
import { ErectorIntakeFlow } from "@/components/onboarding/ErectorIntakeFlow";
import {
  budgetNumber,
  timeframeForApi,
  type CommitmentKey,
  type ErectorIntakeForm,
} from "@/components/onboarding/erector-intake-types";
import { activateBlueprint, ApiError } from "@workspace/api-client-react";
import { apiFetchEnvelope, apiFetchResponseWithRetry, apiPost, completeOnboarding } from "@/lib/torgima-api";
import { ValidationStatus } from "@workspace/state-machine";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type ErectorReviewPhase = "briefing" | "scores" | "paths" | "blueprint";
const TOTAL_STEPS = 7;

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
  "Economy mapped — loading civilization intelligence...",
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

const STEPS = [
  { number: 1, label: "Goal & Purpose", sub: "Outcome, purpose, timeframe" },
  { number: 2, label: "Reality Context", sub: "Economy and business model" },
  { number: 3, label: "Resources", sub: "Budget and assets" },
  { number: 4, label: "Customer", sub: "ICP and success signals" },
  { number: 5, label: "Constraints", sub: "Blockers and summary" },
  { number: 6, label: "Structure", sub: "Refine goal before validation" },
  { number: 7, label: "Validation", sub: "Erector briefing, scores, path, launch" },
];

type ValidationPayload = ValidationScreenData & {
  status?: string;
  validationId?: string;
  canProceed?: boolean;
};

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [selectedPath, setSelectedPath] = useState<"current" | "adjusted" | "alternative">("current");
  const [selectedTier, setSelectedTier] = useState<TierId | null>(null);
  const [selectedMode, setSelectedMode] = useState<ModeId | null>("individual");
  const [goalStructured, setGoalStructured] = useState(false);
  const [erectorPhase, setErectorPhase] = useState<ErectorReviewPhase>("briefing");
  const [pathConfirmed, setPathConfirmed] = useState(false);
  const [, setLocation] = useLocation();

  const idempotencyKeyRef = useRef(crypto.randomUUID());

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
        setError(goalEnvelope.error?.message ?? "Validation failed.");
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
        console.log("[VALIDATION_NAVIGATE]", {
          to: runData.redirectTo ?? "/onboarding",
          erectorPhase: "briefing",
          validationId: payload.erectorValidationId,
        });
        setValidation(payload);
        setErectorPhase("briefing");
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
    const blueprintId = launchValidation.blueprintId;
    const validationContractId =
      launchValidation.erectorValidationContractId || launchValidation.validationContractId;
    if (!blueprintId || !validationContractId) {
      setError("Validation contract is missing. Re-run validation before launch.");
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
    setLoading(true);
    setError("");
    try {
      const saved = await saveBlueprintSelection(blueprintId);
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

      await activateBlueprint(blueprintId, {
        validationContractId,
        validation_contract_id: validationContractId,
        selectedPath,
        selected_path_type: selectedPath,
        selectedBlueprintLevel: selectedTier,
      });

      await completeOnboarding();
      setLocation("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }

  const WHY_THIS_MATTERS: Record<number, { title: string; points: string[]; quote: string; author: string }> = {
    1: {
      title: "Why this matters",
      points: [
        "Personalized execution plan",
        "Daily actionable orders",
        "Progress tracking",
        "Adaptive strategy",
      ],
      quote: "A goal without a plan is just a wish.",
      author: "Antoine de Saint-Exupéry",
    },
    2: {
      title: "Why purpose matters",
      points: [
        "Fuels execution during hard days",
        "Connects daily Orders to meaning",
        "Prevents abandonment",
        "Builds identity",
      ],
      quote: "He who has a why can endure any how.",
      author: "Friedrich Nietzsche",
    },
    3: {
      title: "Why timeframes matter",
      points: ["Creates urgency without panic", "Breaks goals into phases", "Measures real progress", "Adjusts pace intelligently"],
      quote: "A goal is a dream with a deadline.",
      author: "Napoleon Hill",
    },
    4: {
      title: "Why commitment matters",
      points: ["Determines Order intensity", "Sets realistic daily output", "Calibrates difficulty", "Prevents burnout"],
      quote: "Commitment is the foundation of great accomplishments.",
      author: "Heidi Reeder",
    },
    5: {
      title: "Why context matters",
      points: [
        "Orders match your operational reality",
        "Constraints are accounted for",
        "Resources are optimized",
        "Execution is realistic",
      ],
      quote: "Context is everything.",
      author: "The Torgima System",
    },
    6: {
      title: "Why blueprint type matters",
      points: [
        "Tier controls depth and intelligence",
        "Mode controls execution distribution",
        "Structure stays fixed across all types",
        "Launch is blocked until you confirm",
      ],
      quote: "Structure stays fixed. Tier defines intelligence. Mode defines distribution.",
      author: "TORGIMA Master Blueprint",
    },
    7: {
      title: "What happens next",
      points: ["Blueprint generation", "Daily execution orders", "Progress tracking", "Adaptive strategy"],
      quote: "The secret of getting ahead is getting started.",
      author: "Mark Twain",
    },
  };

  const sideInfo = WHY_THIS_MATTERS[step] ?? WHY_THIS_MATTERS[1];
  const showStepNav =
    !(step === 7 && !loading && validation && !error) && !(step === 6 && !goalStructured);
  const validated = isValidationPayloadReady(validation);

  if (step <= 5) {
    return (
      <ErectorIntakeFlow
        step={step as 1 | 2 | 3 | 4 | 5}
        form={form}
        setField={setField}
        toggleResource={toggleResource}
        toggleContextTag={toggleContextTag}
        addBlocker={addBlocker}
        removeBlocker={removeBlocker}
        onStepChange={(s) => setStep(s)}
        onCompleteIntake={() => setStep(6)}
        isSubmitting={loading}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
            <path d="M14 4L4 10V18L14 24L24 18V10L14 4Z" stroke="#111827" strokeWidth="2" fill="none" />
            <path d="M9 13L14 10L19 13" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 10V19" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-bold text-lg text-gray-900">TORGIMA</span>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Step {step} of {TOTAL_STEPS}</span>
            <div className="w-48 bg-gray-200 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-200" aria-hidden />
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-64 border-r border-gray-200 p-6 space-y-1 shrink-0">
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Welcome to</p>
            <p className="text-xl font-bold text-gray-900">TORGIMA</p>
            <p className="text-sm text-gray-500 mt-1">Let&apos;s set up your execution system in a few simple steps.</p>
          </div>

          {STEPS.map((s) => {
            const isDone = s.number < step;
            const isActive = s.number === step;
            const isLocked = s.number > step;
            return (
              <div key={s.number} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${isActive ? "bg-green-50" : ""}`}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    isDone ? "bg-green-500 text-white" : isActive ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.number}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isActive ? "text-gray-900" : isLocked ? "text-gray-400" : "text-gray-700"}`}>
                    {s.label}
                  </p>
                  <p className={`text-xs ${isLocked ? "text-gray-300" : "text-gray-500"}`}>{s.sub}</p>
                </div>
              </div>
            );
          })}

          <div className="pt-6">
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-700">Your data is private and secure.</p>
                <p className="text-xs text-gray-500 mt-0.5">We never share your information.</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col lg:flex-row gap-8 p-6 lg:p-10 max-w-6xl overflow-y-auto">
          <div className="flex-1 space-y-7 min-w-0">
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
                      ← Back to blueprint type
                    </button>
                  </div>
                )}

                {!loading && validated && validation && (
                  <>
                    {erectorPhase === "briefing" && validation.intelligence?.["erector"] && (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">The Erector Reality Briefing</p>
                            <h3 className="text-xl font-bold text-gray-900">
                              {String(((validation.intelligence["erector"] as Record<string, unknown>)["archetypeResolution"] as Record<string, unknown> | undefined)?.["primaryArchetype"] ? (((validation.intelligence["erector"] as Record<string, unknown>)["archetypeResolution"] as Record<string, unknown>)["primaryArchetype"] as Record<string, unknown>)["name"] : "Economy mapped")}
                            </h3>
                          </div>
                          <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-700">
                            Reality Score {String(((validation.intelligence["erector"] as Record<string, unknown>)["scores"] as Record<string, unknown> | undefined)?.["realityScore"] ?? "—")}
                          </div>
                        </div>
                        <p className="text-sm leading-6 text-gray-700">
                          {String(((validation.intelligence["erector"] as Record<string, unknown>)["economyBriefing"] as Record<string, unknown> | undefined)?.["briefingNarrative"] ?? "Economy intelligence loaded before blueprint launch.")}
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl bg-white p-4">
                            <p className="text-xs font-bold uppercase text-amber-600">Warning</p>
                            <p className="mt-2 text-sm text-gray-700">
                              {String((((validation.intelligence["erector"] as Record<string, unknown>)["economyBriefing"] as Record<string, unknown> | undefined)?.["keyWarnings"] as unknown[] | undefined)?.[0] ?? "No critical economy warning.")}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-4">
                            <p className="text-xs font-bold uppercase text-green-600">Opportunity</p>
                            <p className="mt-2 text-sm text-gray-700">
                              {String((((validation.intelligence["erector"] as Record<string, unknown>)["economyBriefing"] as Record<string, unknown> | undefined)?.["keyOpportunities"] as unknown[] | undefined)?.[0] ?? "Narrow first market and prove value quickly.")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {erectorPhase === "briefing" && (
                      <button
                        type="button"
                        onClick={() => setErectorPhase("scores")}
                        className="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl hover:bg-gray-800 text-sm"
                      >
                        View reality scores →
                      </button>
                    )}

                    {erectorPhase === "scores" && validation.intelligence?.["erector"] && (
                      <ErectorScoresDashboard
                        report={buildErectorValidationReport({
                          erector: validation.intelligence["erector"] as Record<string, unknown>,
                          validation: {
                            validationId: validation.validationId ?? validation.erectorValidationId,
                            blueprintId: validation.blueprintId,
                            verdict: validation.verdict,
                            paths: validation.paths,
                          },
                          form: {
                            primaryGoal: form.primaryGoal,
                            purpose: form.purpose,
                            targetCustomer: form.targetCustomer,
                            desiredOutcome: form.desiredOutcome,
                            timeframe: timeframeForGoalApi(form),
                            commitmentLevel: form.commitmentLevel,
                            knownBlockers: form.knownBlockers,
                          },
                          selectedPath,
                        })}
                        onLaunch={() => setErectorPhase("paths")}
                      />
                    )}

                    {erectorPhase === "paths" && validation.intelligence?.["erector"] && (
                      <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50 text-sm text-gray-700">
                        <p className="font-semibold text-gray-900 mb-2">Timeframe simulations</p>
                        <ul className="space-y-2">
                          {(
                            ((validation.intelligence["erector"] as Record<string, unknown>)["timeSimulations"] as Array<
                              Record<string, unknown>
                            >) ?? []
                          ).map((sim) => (
                            <li key={String(sim.timeframe)}>
                              <span className="font-medium">{String(sim.timeframe)}</span>
                              {" — "}
                              {String(sim.executionIntensityLabel ?? "moderate")} intensity,{" "}
                              {Math.round(Number(sim.probabilityOfReachingGoal ?? 0) * 100)}% goal probability
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {erectorPhase === "paths" && validation.intelligence?.["erector"] && (
                      <FirstWeekPlanPanel
                        erector={
                          {
                            plans: (
                              (validation.paths?.[selectedPath] as Record<string, unknown> | undefined)?.[
                                "firstWeekActionsPreview"
                              ] as string[] | undefined
                            )?.map((title) => ({
                              title,
                              action: "Smoke test — completes at blueprint launch.",
                              smokeTest: true,
                            })),
                          } as Record<string, unknown>
                        }
                      />
                    )}

                    {erectorPhase === "paths" && (
                      <ValidationScreen
                        data={validation}
                        tier={selectedTier}
                        selectedPath={selectedPath}
                        hideErectorDashboard
                        onSelectPath={(p: PathKey) => {
                          setSelectedPath(p);
                          setPathConfirmed(false);
                        }}
                        onLaunch={pathConfirmed ? () => setErectorPhase("blueprint") : undefined}
                        launching={loading}
                        goalSummary={{
                          goal: form.primaryGoal,
                          purpose: form.purpose,
                          timeframe: timeframeForGoalApi(form),
                        }}
                      />
                    )}

                    {erectorPhase === "scores" && (
                      <button
                        type="button"
                        onClick={() => setErectorPhase("paths")}
                        className="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl hover:bg-gray-800 text-sm"
                      >
                        Choose execution path →
                      </button>
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
                        disabled={loading || !selectedTier || !selectedMode}
                        className="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl hover:bg-gray-800 disabled:opacity-40 text-sm"
                      >
                        Launch blueprint
                      </button>
                    )}

                    {error && <p className="text-red-500 text-sm">{error}</p>}
                  </>
                )}
              </>
            )}

            {showStepNav && (
              <div className="pt-2">
                {step < 7 && (
                  <button
                    type="button"
                    onClick={() => void handleNext()}
                    disabled={!canContinue()}
                    className="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
                  >
                    {step === 6 ? "Continue to validation →" : "Continue →"}
                  </button>
                )}
                {step > 1 && step < 7 && (
                  <p className="text-center text-xs text-gray-400 mt-3">
                    <button type="button" onClick={() => setStep((s) => (s - 1) as Step)} className="hover:text-gray-600">
                      ← Back
                    </button>
                  </p>
                )}
                <p className="text-center text-xs text-gray-400 mt-2">🔒 You can always edit these details later.</p>
              </div>
            )}
          </div>

          <div className="w-full lg:w-72 shrink-0 space-y-4">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                  <Target className="w-4 h-4 text-green-600" />
                </div>
                <p className="font-semibold text-gray-900 text-sm">{sideInfo.title}</p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Clear goals help TORGIMA create a blueprint that aligns with what truly matters to you.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">You&apos;ll get:</p>
                {sideInfo.points.map((point, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <p className="text-xs text-gray-600">{point}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-2xl text-gray-400 mb-1">&ldquo;</p>
                <p className="text-sm text-gray-700 italic leading-relaxed">{sideInfo.quote}</p>
                <p className="text-xs text-gray-400 mt-2">— {sideInfo.author}</p>
              </div>
            </div>

            {step === 7 && !loading && validated && validation && erectorPhase === "paths" && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Choose Your Path</h3>
                  <p className="text-xs text-gray-500">
                    Select the path that best fits your current reality. Launch stays blocked until you confirm a path.
                  </p>
                </div>

                <div className="space-y-3">
                  {(["current", "adjusted", "alternative"] as const).map((pathKey) => {
                    const path = validation.paths?.[pathKey];
                    if (!path) return null;
                    const isSelected = selectedPath === pathKey;
                    const pathConfig = {
                      current: { label: "Current Path", badge: "Recommended", icon: "🚩", badgeColor: "bg-green-100 text-green-700" },
                      adjusted: { label: "Adjusted Path", badge: null, icon: "⚙️", badgeColor: "" },
                      alternative: { label: "Alternative Path", badge: null, icon: "↗️", badgeColor: "" },
                    }[pathKey];

                    return (
                      <button
                        key={pathKey}
                        type="button"
                        onClick={() => setSelectedPath(pathKey)}
                        className={`w-full text-left border-2 rounded-xl p-4 cursor-pointer transition-all ${
                          isSelected ? "border-green-500 bg-white shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span>{pathConfig.icon}</span>
                            <p className="font-semibold text-sm text-gray-900">{pathConfig.label}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {pathConfig.badge && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pathConfig.badgeColor}`}>
                                {pathConfig.badge}
                              </span>
                            )}
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? "border-green-500" : "border-gray-300"
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-green-500" />}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{String((path as { summary?: string }).summary ?? "")}</p>
                        <div className="mt-2 space-y-1">
                          {((path as { strengths?: string[] }).strengths ?? ["Aligned with validation"]).slice(0, 2).map((b: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                              <p className="text-xs text-gray-600">{b}</p>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPathConfirmed(true);
                    setErectorPhase("blueprint");
                  }}
                  disabled={
                    loading ||
                    (validation.launchBlocked && selectedPath === "current") ||
                    (validation.verdict === "pivot" && selectedPath === "current")
                  }
                  className="w-full bg-gray-900 text-white font-semibold py-3.5 rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all text-sm"
                >
                  Confirm path and choose blueprint tier →
                </button>

                <button
                  type="button"
                  className="w-full border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-50 text-sm"
                >
                  ↩ Save & Review Later
                </button>

                <div className="pt-2 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">What Happens Next?</p>
                  {[
                    { n: "1.", label: "Blueprint Generation", sub: "We'll create your personalized execution blueprint." },
                    { n: "2.", label: "Daily Execution", sub: "You'll get actionable orders every day." },
                    { n: "3.", label: "Track & Adapt", sub: "We track your progress and adapt as you grow." },
                  ].map((item) => (
                    <div key={item.n} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-gray-400 shrink-0">{item.n}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
