import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INTAKE_STEP_LABELS,
  saveIntakeSection,
  type IntakeSession,
} from "@/lib/erector-intake-api";
import { estimateIntakeMinutesRemaining } from "@/lib/onboarding-doc32";
import { ERECTOR_LABELS } from "@/lib/language-map";

type SectionData = Record<string, string>;

type Props = {
  session: IntakeSession;
  onSessionUpdate: (session: IntakeSession) => void;
  onComplete: () => void;
  completing?: boolean;
};

function readSection(session: IntakeSession, section: number): SectionData {
  const key = `section_${section}_data` as keyof IntakeSession;
  const raw = session[key];
  if (!raw || typeof raw !== "object") return {};
  const out: SectionData = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (v != null) out[k] = String(v);
  }
  return out;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  disabled,
  error,
  prefilled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  error?: string;
  prefilled?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#0A0F1E]";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="block text-sm font-semibold text-[#0A0F1E]" htmlFor={id}>
          {label}
        </label>
        {prefilled ? (
          <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4338CA]">
            Pre-filled from your analysis
          </span>
        ) : null}
      </div>
      {multiline ? (
        <textarea
          id={id}
          rows={4}
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      ) : (
        <input
          id={id}
          type="text"
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function validateSection(step: number, data: SectionData): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = (key: string, label: string, min = 3) => {
    if (!data[key]?.trim() || data[key].trim().length < min) {
      errors[key] = `${label} is required.`;
    }
  };

  if (step === 1) {
    required("projectName", "Project name");
    required("whatBuilding", "What you are building", 10);
    required("whyItMatters", "Why it matters", 10);
    required("desiredOutcome", "Desired outcome", 10);
  }
  if (step === 2) {
    required("who", "Target customer", 10);
    required("problem", "Problem they face", 10);
    required("urgency", "Urgency level");
    required("payingForAlternatives", "What they pay for today", 5);
  }
  if (step === 3) {
    required("location", "Market location");
    required("scope", "Market scope");
    required("competitors", "Competitors", 5);
    required("differentiation", "Your differentiation", 10);
  }
  if (step === 4) {
    required("revenueModel", "Revenue model");
    required("priceRange", "Price range");
    required("modelType", "Business model type");
  }
  if (step === 5) {
    required("budget", "Budget");
    required("hoursPerWeek", "Hours per week");
    required("teamSize", "Team size");
    required("skillsPresent", "Skills you have", 3);
    required("skillsMissing", "Skills you need", 3);
  }
  if (step === 6) {
    required("launchDate", "Launch date");
    required("firstCustomersDate", "First customers date");
    required("finalTargetDate", "Final target date");
  }
  if (step === 7) {
    required("blockers", "Main blockers", 5);
    required("priorAttempts", "Prior attempts", 3);
  }
  if (step === 8) {
    required("success30Days", "30-day success", 10);
    required("success90Days", "90-day success", 10);
    required("success12Months", "12-month success", 10);
  }
  return errors;
}

export function IntakeWizard({ session, onSessionUpdate, onComplete, completing }: Props) {
  const prefilledSections = new Set(session.sections_completed ?? []);
  const sectionPrefilled = session.prefilled_from_handoff === true;

  const initialStep = useMemo(() => {
    const cur = session.current_section;
    if (cur >= 1 && cur <= 8) return cur;
    const completed = session.sections_completed ?? [];
    if (completed.length >= 8) return 8;
    const firstIncomplete = INTAKE_STEP_LABELS.findIndex((_, i) => !completed.includes(i + 1));
    return firstIncomplete === -1 ? 1 : firstIncomplete + 1;
  }, [session.current_section, session.sections_completed]);

  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState<SectionData>(() => readSection(session, initialStep));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const minutesRemaining = estimateIntakeMinutesRemaining(session.sections_completed?.length ?? 0);

  useEffect(() => {
    setData(readSection(session, step));
    setErrors({});
    setSaveError(null);
  }, [session, step]);

  const patch = useCallback((key: string, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const progressPct = Math.round(((session.sections_completed?.length ?? 0) / 8) * 100);

  async function handleSave(andAdvance: boolean) {
    const fieldErrors = validateSection(step, data);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await saveIntakeSection(session.id, step, data);
      onSessionUpdate(updated);
      setSavedAt(new Date());
      if (andAdvance) {
        if (step < 8) setStep(step + 1);
        else onComplete();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save this step.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || completing;
  const showHandoffBanner = sectionPrefilled && [1, 3, 5].some((n) => prefilledSections.has(n));
  const fieldPrefilled = (key: string) =>
    sectionPrefilled && prefilledSections.has(step) && Boolean(readSection(session, step)[key]?.trim());

  function renderStepFields() {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <Field id="projectName" label="Project name" value={data.projectName ?? ""} onChange={(v) => patch("projectName", v)} disabled={disabled} error={errors.projectName} prefilled={fieldPrefilled("projectName")} />
            <Field id="whatBuilding" label="What are you building?" value={data.whatBuilding ?? ""} onChange={(v) => patch("whatBuilding", v)} multiline disabled={disabled} error={errors.whatBuilding} prefilled={fieldPrefilled("whatBuilding")} />
            <Field id="whyItMatters" label="Why does this matter to you?" value={data.whyItMatters ?? ""} onChange={(v) => patch("whyItMatters", v)} multiline disabled={disabled} error={errors.whyItMatters} prefilled={fieldPrefilled("whyItMatters")} />
            <Field id="desiredOutcome" label="What outcome do you want?" value={data.desiredOutcome ?? ""} onChange={(v) => patch("desiredOutcome", v)} multiline disabled={disabled} error={errors.desiredOutcome} />
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <Field id="who" label="Who is your target customer?" value={data.who ?? ""} onChange={(v) => patch("who", v)} multiline disabled={disabled} error={errors.who} />
            <Field id="problem" label="What problem do they have?" value={data.problem ?? ""} onChange={(v) => patch("problem", v)} multiline disabled={disabled} error={errors.problem} />
            <Field id="urgency" label="How urgent is this problem?" value={data.urgency ?? ""} onChange={(v) => patch("urgency", v)} disabled={disabled} error={errors.urgency} />
            <Field id="payingForAlternatives" label="What do they pay for today?" value={data.payingForAlternatives ?? ""} onChange={(v) => patch("payingForAlternatives", v)} multiline disabled={disabled} error={errors.payingForAlternatives} />
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <Field id="location" label="Where is your market?" value={data.location ?? ""} onChange={(v) => patch("location", v)} disabled={disabled} error={errors.location} prefilled={fieldPrefilled("location")} />
            <Field id="scope" label="Market scope (local, national, global)" value={data.scope ?? ""} onChange={(v) => patch("scope", v)} disabled={disabled} error={errors.scope} />
            <Field id="competitors" label="Who are your main competitors?" value={data.competitors ?? ""} onChange={(v) => patch("competitors", v)} multiline disabled={disabled} error={errors.competitors} />
            <Field id="differentiation" label="How are you different?" value={data.differentiation ?? ""} onChange={(v) => patch("differentiation", v)} multiline disabled={disabled} error={errors.differentiation} />
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <Field id="revenueModel" label="How will you make money?" value={data.revenueModel ?? ""} onChange={(v) => patch("revenueModel", v)} disabled={disabled} error={errors.revenueModel} />
            <Field id="priceRange" label="Expected price range" value={data.priceRange ?? ""} onChange={(v) => patch("priceRange", v)} disabled={disabled} error={errors.priceRange} />
            <Field id="modelType" label="Business model type (SaaS, service, etc.)" value={data.modelType ?? ""} onChange={(v) => patch("modelType", v)} disabled={disabled} error={errors.modelType} />
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <Field id="budget" label="Available budget" value={data.budget ?? ""} onChange={(v) => patch("budget", v)} disabled={disabled} error={errors.budget} prefilled={fieldPrefilled("budget")} />
            <Field id="hoursPerWeek" label="Hours per week you can commit" value={data.hoursPerWeek ?? ""} onChange={(v) => patch("hoursPerWeek", v)} disabled={disabled} error={errors.hoursPerWeek} />
            <Field id="teamSize" label="Team size" value={data.teamSize ?? ""} onChange={(v) => patch("teamSize", v)} disabled={disabled} error={errors.teamSize} />
            <Field id="skillsPresent" label="Skills you already have (comma-separated)" value={data.skillsPresent ?? ""} onChange={(v) => patch("skillsPresent", v)} multiline disabled={disabled} error={errors.skillsPresent} />
            <Field id="skillsMissing" label="Skills you still need (comma-separated)" value={data.skillsMissing ?? ""} onChange={(v) => patch("skillsMissing", v)} multiline disabled={disabled} error={errors.skillsMissing} />
          </div>
        );
      case 6:
        return (
          <div className="space-y-5">
            <Field id="launchDate" label="Target launch date" value={data.launchDate ?? ""} onChange={(v) => patch("launchDate", v)} placeholder="e.g. 2026-09-01" disabled={disabled} error={errors.launchDate} />
            <Field id="firstCustomersDate" label="When do you want first paying customers?" value={data.firstCustomersDate ?? ""} onChange={(v) => patch("firstCustomersDate", v)} disabled={disabled} error={errors.firstCustomersDate} />
            <Field id="finalTargetDate" label="Final milestone date" value={data.finalTargetDate ?? ""} onChange={(v) => patch("finalTargetDate", v)} disabled={disabled} error={errors.finalTargetDate} />
          </div>
        );
      case 7:
        return (
          <div className="space-y-5">
            <Field id="blockers" label="What could block you?" value={data.blockers ?? ""} onChange={(v) => patch("blockers", v)} multiline disabled={disabled} error={errors.blockers} />
            <Field id="legalBarriers" label="Legal barriers (optional)" value={data.legalBarriers ?? ""} onChange={(v) => patch("legalBarriers", v)} multiline disabled={disabled} />
            <Field id="technicalBarriers" label="Technical barriers (optional)" value={data.technicalBarriers ?? ""} onChange={(v) => patch("technicalBarriers", v)} multiline disabled={disabled} />
            <Field id="financialBarriers" label="Financial barriers (optional)" value={data.financialBarriers ?? ""} onChange={(v) => patch("financialBarriers", v)} multiline disabled={disabled} />
            <Field id="priorAttempts" label="What have you tried before?" value={data.priorAttempts ?? ""} onChange={(v) => patch("priorAttempts", v)} multiline disabled={disabled} error={errors.priorAttempts} />
          </div>
        );
      case 8:
        return (
          <div className="space-y-5">
            <Field id="success30Days" label="Success at 30 days looks like…" value={data.success30Days ?? ""} onChange={(v) => patch("success30Days", v)} multiline disabled={disabled} error={errors.success30Days} />
            <Field id="success90Days" label="Success at 90 days looks like…" value={data.success90Days ?? ""} onChange={(v) => patch("success90Days", v)} multiline disabled={disabled} error={errors.success90Days} />
            <Field id="success12Months" label="Success at 12 months looks like…" value={data.success12Months ?? ""} onChange={(v) => patch("success12Months", v)} multiline disabled={disabled} error={errors.success12Months} />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pb-16">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
          {ERECTOR_LABELS.erector_authenticated}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#0A0F1E]">{INTAKE_STEP_LABELS[step - 1]}</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Section {step} of {INTAKE_STEP_LABELS.length} · About {minutesRemaining} minutes remaining
        </p>
        {savedAt ? (
          <p className="mt-1 text-xs font-medium text-emerald-700" role="status">
            Saved just now
          </p>
        ) : null}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
          <div className="h-full rounded-full bg-[#16A34A] transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        {showHandoffBanner ? (
          <p className="mt-4 rounded-xl bg-[#EEF2FF] px-4 py-3 text-sm text-[#3730A3]">
            These details were carried over from your free analysis. You can review and edit any field.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {INTAKE_STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = (session.sections_completed ?? []).includes(n);
            const handoffDone = sectionPrefilled && [1, 3, 5].includes(n) && done;
            const active = n === step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(n)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  active
                    ? "bg-[#0A0F1E] text-white"
                    : handoffDone
                      ? "bg-[#E0E7FF] text-[#4338CA]"
                      : done
                        ? "bg-[#DCFCE7] text-[#166534]"
                        : "bg-[#F1F5F9] text-[#64748B]"
                }`}
              >
                {handoffDone ? `${label} · Pre-filled` : label}
              </button>
            );
          })}
        </div>
      </div>

      {renderStepFields()}

      {saveError ? <p className="mt-4 text-sm text-red-600">{saveError}</p> : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {step > 1 ? (
          <button
            type="button"
            className="rounded-xl border border-[#E5E7EB] px-5 py-3 text-sm font-semibold text-[#0A0F1E]"
            onClick={() => setStep(step - 1)}
            disabled={disabled}
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-xl border border-[#E5E7EB] px-5 py-3 text-sm font-semibold text-[#0A0F1E]"
          onClick={() => void handleSave(false)}
          disabled={disabled}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="rounded-xl bg-[#16A34A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => void handleSave(true)}
          disabled={disabled}
        >
          {step < 8 ? (saving ? "Saving…" : "Save & continue") : completing ? "Analyzing…" : "Complete & analyze"}
        </button>
      </div>
    </div>
  );
}
