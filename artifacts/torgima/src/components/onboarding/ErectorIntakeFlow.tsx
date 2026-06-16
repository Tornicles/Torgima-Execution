import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { INTELLIGENCE_COPY } from "@/lib/language-map";
import { apiFetchEnvelope } from "@/lib/torgima-api";
import {
  BUSINESS_MODELS,
  COMMITMENT_OPTIONS,
  CONTEXT_TAG_OPTIONS,
  CURRENCIES,
  RESOURCE_OPTIONS,
  TIMEFRAME_OPTIONS,
  type CommitmentKey,
  type ErectorIntakeForm,
  type IntakeErrors,
  type TimeframeKey,
  budgetNumber,
  computeReadiness,
  validateFullIntake,
  validateIntakeStep,
} from "./erector-intake-types";

const PROGRESS_STEPS = [
  { n: 1, label: "Goal & Purpose" },
  { n: 2, label: "Reality Context" },
  { n: 3, label: "Resources & Budget" },
  { n: 4, label: "Customer & Outcome" },
  { n: 5, label: "Constraints" },
  { n: 6, label: "Run Erector" },
] as const;

type ArchetypePreview = {
  name: string;
  dimensions?: { label: string; value: number }[];
};

export function ErectorIntakeFlow({
  step,
  form,
  setField,
  toggleResource,
  toggleContextTag,
  addBlocker,
  removeBlocker,
  onStepChange,
  onCompleteIntake,
  isSubmitting,
}: {
  step: 1 | 2 | 3 | 4 | 5;
  form: ErectorIntakeForm;
  setField: <K extends keyof ErectorIntakeForm>(key: K, value: ErectorIntakeForm[K]) => void;
  toggleResource: (label: string) => void;
  toggleContextTag: (tag: string) => void;
  addBlocker: (text: string) => void;
  removeBlocker: (index: number) => void;
  onStepChange: (step: 1 | 2 | 3 | 4 | 5) => void;
  onCompleteIntake: () => void;
  isSubmitting?: boolean;
}) {
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [blockerDraft, setBlockerDraft] = useState("");
  const [archetype, setArchetype] = useState<ArchetypePreview | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readiness = computeReadiness(form, step);

  const fetchArchetype = useCallback(async (country: string) => {
    if (country.trim().length < 2) {
      setArchetype(null);
      return;
    }
    const envelope = await apiFetchEnvelope<Array<Record<string, unknown>>>(
      `/api/v1/validation/archetypes?country=${encodeURIComponent(country.trim())}`,
    );
    if (!envelope.ok || !envelope.data?.length) {
      const resolveEnvelope = await apiFetchEnvelope<{ primaryArchetype?: { name?: string; institutionalStrength?: number; digitalAdoption?: number; consumerPurchasingPower?: number; startupEcosystemMaturity?: number; regulatoryOpenness?: number } }>(
        `/api/v1/validation/resolve-archetype`,
        {
          method: "POST",
          body: JSON.stringify({ country: country.trim(), city: form.locationCity.trim() || undefined }),
        },
      );
      const primary = resolveEnvelope.data?.primaryArchetype;
      if (primary?.name) {
        setArchetype({
          name: primary.name,
          dimensions: [
            { label: "Institutional", value: Number(primary.institutionalStrength ?? 5) * 10 },
            { label: "Digital", value: Number(primary.digitalAdoption ?? 5) * 10 },
            { label: "Purchasing power", value: Number(primary.consumerPurchasingPower ?? 5) * 10 },
            { label: "Startup ecosystem", value: Number(primary.startupEcosystemMaturity ?? 5) * 10 },
            { label: "Regulatory", value: Number(primary.regulatoryOpenness ?? 5) * 10 },
          ],
        });
      }
      return;
    }
    const match =
      envelope.data.find((row) =>
        String(row.countries ?? row.country ?? "")
          .toLowerCase()
          .includes(country.trim().toLowerCase()),
      ) ?? envelope.data[0];
    setArchetype({
      name: String(match.name ?? "Economy archetype"),
      dimensions: [
        { label: "Institutional", value: Math.round(Number(match.institutionalStrength ?? 5) * 10) },
        { label: "Digital", value: Math.round(Number(match.digitalAdoption ?? 5) * 10) },
        { label: "Purchasing power", value: Math.round(Number(match.consumerPurchasingPower ?? 5) * 10) },
        { label: "Startup ecosystem", value: Math.round(Number(match.startupEcosystemMaturity ?? 5) * 10) },
        { label: "Regulatory", value: Math.round(Number(match.regulatoryOpenness ?? 5) * 10) },
      ],
    });
  }, [form.locationCity]);

  useEffect(() => {
    if (step < 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchArchetype(form.locationCountry);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.locationCountry, step, fetchArchetype]);

  function fieldError(name: keyof IntakeErrors) {
    const msg = errors[name];
    if (!msg) return null;
    return <p className="text-xs text-red-400 mt-1" data-field-error={name}>{msg}</p>;
  }

  function scrollToFirstError(nextErrors: IntakeErrors) {
    const first = Object.keys(nextErrors)[0];
    if (!first) return;
    const el = document.querySelector(`[data-field-error="${first}"], [data-field="${first}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleContinue() {
    const stepErrors = validateIntakeStep(step, form);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      scrollToFirstError(stepErrors);
      return;
    }
    if (step < 5) onStepChange((step + 1) as 1 | 2 | 3 | 4 | 5);
  }

  function handleRunErector() {
    const allErrors = validateFullIntake(form);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      scrollToFirstError(allErrors);
      return;
    }
    onCompleteIntake();
  }

  const goalClarity =
    form.primaryGoal.length >= 20 ? "Clear" : form.primaryGoal.length > 0 ? "Developing" : "Pending";
  const purposeStrength = form.purpose.length >= 20 ? "Strong" : form.purpose.length > 0 ? "Developing" : "Pending";

  return (
    <div className="min-h-screen bg-[#080A0E] text-gray-100 flex flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-[#1B1F2E] bg-[#0C0E14]/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-widest text-green-400">TORGIMA</span>
          <span className="text-xs text-gray-500">Erector intake</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Draft auto-saving
        </div>
      </header>

      <nav className="border-b border-[#1B1F2E] bg-[#0C0E14] px-4 py-3 overflow-x-auto">
        <div className="flex gap-1 min-w-max max-w-6xl mx-auto">
          {PROGRESS_STEPS.map((s) => {
            const done = s.n < step;
            const active = s.n === step;
            const pending = s.n > step;
            const isRun = s.n === 6;
            return (
              <div
                key={s.n}
                className={`flex-1 min-w-[120px] px-3 py-2 border-b-2 transition-colors ${
                  active ? "border-orange-500" : done ? "border-green-600" : "border-transparent"
                } ${isRun ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono ${active ? "text-white" : pending && !isRun ? "text-gray-600" : "text-gray-400"}`}
                  >
                    {String(s.n).padStart(2, "0")}
                  </span>
                  {done && <Check className="w-3 h-3 text-green-500" />}
                  <span className={`text-xs font-medium truncate ${active ? "text-white" : "text-gray-500"}`}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4 lg:p-6 grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6 min-w-0">
          {step === 1 && (
            <section className="space-y-5" data-step="1">
              <div>
                <h2 className="text-xl font-semibold text-white">Goal &amp; purpose</h2>
                <p className="text-sm text-gray-500 mt-1">Define the outcome and why it matters before economy validation.</p>
              </div>
              <div data-field="primaryGoal">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Goal</label>
                <textarea
                  value={form.primaryGoal}
                  onChange={(e) => setField("primaryGoal", e.target.value)}
                  placeholder="Describe the specific outcome you want to achieve."
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 min-h-[110px]"
                />
                {fieldError("primaryGoal")}
                {form.primaryGoal.length > 30 && (
                  <p className="mt-2 text-xs text-blue-400/90">
                    {INTELLIGENCE_COPY.intakeDetected}
                  </p>
                )}
              </div>
              <div data-field="purpose">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Purpose</label>
                <textarea
                  value={form.purpose}
                  onChange={(e) => setField("purpose", e.target.value)}
                  placeholder="Why does this goal matter? What problem does it solve — for you and for others?"
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                {fieldError("purpose")}
              </div>
              <div data-field="timeframeKey">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Timeframe</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TIMEFRAME_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setField("timeframeKey", opt.key)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        form.timeframeKey === opt.key
                          ? "border-orange-500 text-orange-400 bg-orange-950/40"
                          : "border-[#2A3044] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {fieldError("timeframeKey")}
              </div>
              {form.timeframeKey === "custom" && (
                <div data-field="customTimeframeDays">
                  <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Custom days</label>
                  <input
                    type="number"
                    min={1}
                    value={form.customTimeframeDays ?? ""}
                    onChange={(e) => setField("customTimeframeDays", Number(e.target.value) || undefined)}
                    className="mt-2 w-full max-w-xs rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-2 text-sm"
                  />
                  {fieldError("customTimeframeDays")}
                </div>
              )}
              <div data-field="commitmentLevel">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Commitment level</label>
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  {COMMITMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setField("commitmentLevel", opt.key as CommitmentKey)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        form.commitmentLevel === opt.key
                          ? "border-yellow-500 bg-yellow-950/30"
                          : "border-[#2A3044] hover:border-gray-500"
                      }`}
                    >
                      <p className="text-sm font-bold">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.sub}</p>
                    </button>
                  ))}
                </div>
                {fieldError("commitmentLevel")}
              </div>
              <div data-field="desiredOutcome">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Desired outcome</label>
                <textarea
                  value={form.desiredOutcome}
                  onChange={(e) => setField("desiredOutcome", e.target.value)}
                  placeholder="What does success look like at 90 days, 6 months, and at your target timeframe?"
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                {fieldError("desiredOutcome")}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-5" data-step="2">
              <div>
                <h2 className="text-xl font-semibold text-white">Reality context</h2>
                <p className="text-sm text-gray-500 mt-1">Economy, business model, and starting conditions for validation.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div data-field="locationCountry">
                  <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Country</label>
                  <input
                    value={form.locationCountry}
                    onChange={(e) => setField("locationCountry", e.target.value)}
                    placeholder="United States, Nigeria, Germany…"
                    className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm"
                  />
                  {fieldError("locationCountry")}
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-widest text-gray-500">City (optional)</label>
                  <input
                    value={form.locationCity}
                    onChange={(e) => setField("locationCity", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm"
                  />
                </div>
              </div>
              <div data-field="businessType">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Business type</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["online", "offline", "hybrid"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setField("businessType", type)}
                      className={`rounded-lg border px-4 py-2 text-xs font-semibold uppercase ${
                        form.businessType === type ? "border-orange-500 text-orange-400" : "border-[#2A3044] text-gray-400"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {fieldError("businessType")}
              </div>
              <div data-field="businessModel">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Business model</label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BUSINESS_MODELS.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => setField("businessModel", model)}
                      className={`rounded-lg border p-3 text-xs font-semibold ${
                        form.businessModel === model ? "border-orange-500 text-orange-400 bg-orange-950/30" : "border-[#2A3044] text-gray-400"
                      }`}
                    >
                      {model}
                    </button>
                  ))}
                </div>
                {fieldError("businessModel")}
              </div>
              <div data-field="currentContext">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Current context</label>
                <textarea
                  value={form.currentContext}
                  onChange={(e) => setField("currentContext", e.target.value)}
                  placeholder="Describe where you are starting from. What constraints, friction, or starting conditions apply?"
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm"
                />
                {fieldError("currentContext")}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-5" data-step="3">
              <div>
                <h2 className="text-xl font-semibold text-white">Resources &amp; budget</h2>
                <p className="text-sm text-gray-500 mt-1">Capital and assets available for execution.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div data-field="currency">
                  <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setField("currency", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {fieldError("currency")}
                </div>
                <div data-field="budgetAvailable">
                  <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Budget available</label>
                  <input
                    type="number"
                    min={1}
                    value={form.budgetAvailable}
                    onChange={(e) => setField("budgetAvailable", e.target.value)}
                    placeholder="2500"
                    className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm"
                  />
                  {fieldError("budgetAvailable")}
                </div>
              </div>
              <div data-field="currentResources">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Current resources</label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RESOURCE_OPTIONS.map((resource) => {
                    const checked = form.currentResources.includes(resource);
                    return (
                      <button
                        key={resource}
                        type="button"
                        onClick={() => toggleResource(resource)}
                        className={`rounded-lg border p-3 text-left text-xs font-medium transition-colors ${
                          checked ? "border-green-600 bg-green-950/40 text-green-300" : "border-[#2A3044] text-gray-400"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 inline mr-1" />}
                        {resource}
                      </button>
                    );
                  })}
                </div>
                {fieldError("currentResources")}
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-5" data-step="4">
              <div>
                <h2 className="text-xl font-semibold text-white">Customer &amp; outcome</h2>
                <p className="text-sm text-gray-500 mt-1">Who pays and how you measure real progress.</p>
              </div>
              <div data-field="targetCustomer">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Target customer</label>
                <textarea
                  value={form.targetCustomer}
                  onChange={(e) => setField("targetCustomer", e.target.value)}
                  placeholder="Who specifically is this for? Be precise — not small businesses, but [exact ICP description]."
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm min-h-[110px]"
                />
                {fieldError("targetCustomer")}
                {form.targetCustomer.length > 40 && (
                  <p className="mt-2 text-xs text-blue-400/90">
                    Specific ICP detected. Pain profile will be cross-referenced against archetype consumer behaviour patterns.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Success signal (recommended)</label>
                <textarea
                  value={form.successSignal}
                  onChange={(e) => setField("successSignal", e.target.value)}
                  placeholder="How will you know progress is real? What observable signals show execution is working?"
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Context tags (optional)</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONTEXT_TAG_OPTIONS.map((tag) => {
                    const on = form.contextTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleContextTag(tag)}
                        className={`rounded-full border px-3 py-1.5 text-xs ${
                          on ? "border-orange-500 text-orange-400 bg-orange-950/30" : "border-[#2A3044] text-gray-500"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="space-y-5" data-step="5">
              <div>
                <h2 className="text-xl font-semibold text-white">Constraints</h2>
                <p className="text-sm text-gray-500 mt-1">Blockers and additional execution reality before validation runs.</p>
              </div>
              <div data-field="knownBlockers">
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Known blockers</label>
                <div className="mt-2 rounded-lg border border-[#2A3044] bg-[#13161F] p-3 flex flex-wrap gap-2 min-h-[52px]">
                  {form.knownBlockers.map((tag, i) => (
                    <span key={tag + i} className="inline-flex items-center gap-1 rounded-md bg-[#1B1F2E] px-2 py-1 text-xs">
                      {tag}
                      <button type="button" onClick={() => removeBlocker(i)} className="text-gray-500 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={blockerDraft}
                    onChange={(e) => setBlockerDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && blockerDraft.trim()) {
                        e.preventDefault();
                        addBlocker(blockerDraft.trim());
                        setBlockerDraft("");
                      }
                    }}
                    placeholder="Type blocker and press Enter"
                    className="flex-1 min-w-[160px] bg-transparent text-sm outline-none placeholder:text-gray-600"
                  />
                </div>
                {fieldError("knownBlockers")}
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-widest text-gray-500">Additional context (optional)</label>
                <textarea
                  value={form.additionalContext}
                  onChange={(e) => setField("additionalContext", e.target.value)}
                  placeholder="Anything not captured above that affects execution reality."
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-[#2A3044] bg-[#13161F] px-4 py-3 text-sm"
                />
              </div>
              <div className="rounded-lg border border-[#2A3044] bg-[#10121A] p-4 space-y-2 text-sm">
                <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Validation summary</p>
                <p><span className="text-gray-500">Goal:</span> {form.primaryGoal.slice(0, 60) || "—"}{form.primaryGoal.length > 60 ? "…" : ""}</p>
                <p><span className="text-gray-500">Archetype:</span> {archetype?.name ?? "Pending country"}</p>
                <p><span className="text-gray-500">Commitment:</span> {form.commitmentLevel}</p>
                <p><span className="text-gray-500">Engines:</span> 9/9 ready</p>
                <p><span className="text-gray-500">{INTELLIGENCE_COPY.intakeCalls}</span> 10</p>
                <p><span className="text-gray-500">Estimated runtime:</span> ~45 seconds</p>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-[#2A3044] px-5 py-3 text-sm font-semibold text-gray-300 hover:bg-[#13161F]"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRunErector}
                  className="flex-1 min-w-[200px] rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Preparing validation…" : "Run Erector validation →"}
                </button>
              </div>
            </section>
          )}

          {step < 5 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#1B1F2E]">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => onStepChange((step - 1) as 1 | 2 | 3 | 4 | 5)}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleContinue}
                className="rounded-lg bg-gray-100 text-gray-900 px-6 py-2.5 text-sm font-semibold hover:bg-white"
              >
                Continue →
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-[#1B1F2E] bg-[#10121A] p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-500">{INTELLIGENCE_COPY.intakeLabel}</p>
            <ul className="space-y-2 text-xs">
              <li className="flex justify-between"><span className="text-gray-500">Goal clarity</span><span className="text-gray-200">{goalClarity}</span></li>
              <li className="flex justify-between"><span className="text-gray-500">Purpose strength</span><span className="text-gray-200">{purposeStrength}</span></li>
              <li className="flex justify-between"><span className="text-gray-500">Archetype</span><span className="text-gray-200">{archetype?.name ?? "Pending"}</span></li>
              <li className="flex justify-between"><span className="text-gray-500">Engines ready</span><span className="text-green-400">9/9</span></li>
            </ul>
          </div>

          <div className="rounded-lg border border-[#1B1F2E] bg-[#10121A] p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Archetype preview</p>
            {archetype ? (
              <>
                <p className="text-sm font-semibold text-green-400">{archetype.name}</p>
                <div className="space-y-2">
                  {(archetype.dimensions ?? []).map((d) => (
                    <div key={d.label}>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                        <span>{d.label}</span>
                        <span>{d.value}%</span>
                      </div>
                      <div className="h-1 bg-[#1B1F2E] rounded-full overflow-hidden">
                        <div className="h-full bg-green-600 rounded-full" style={{ width: `${Math.min(100, d.value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">Enter a country on step 2 to resolve economy archetype.</p>
            )}
          </div>

          <div className="rounded-lg border border-[#1B1F2E] bg-[#10121A] p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Validation readiness</p>
            <ul className="space-y-1.5">
              {readiness.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      item.status === "done"
                        ? "bg-green-900 text-green-400"
                        : item.status === "active"
                          ? "bg-orange-900 text-orange-400"
                          : "bg-[#1B1F2E] text-gray-600"
                    }`}
                  >
                    {item.status === "done" ? "✓" : ""}
                  </span>
                  <span className={item.status === "done" ? "text-gray-300" : "text-gray-500"}>{item.label}</span>
                </li>
              ))}
            </ul>
            <div>
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Complete</span>
                <span>{readiness.percent}%</span>
              </div>
              <div className="h-1.5 bg-[#1B1F2E] rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${readiness.percent}%` }} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
