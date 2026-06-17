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
            Pre-filled from your free validation
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
    required("project_name", "Project name");
    required("project_description", "What you are building", 10);
    required("primary_goal", "Primary goal", 8);
    required("project_purpose", "Why this matters", 8);
    required("success_definition", "Success definition", 8);
    required("failure_definition", "Failure definition", 8);
  }
  if (step === 2) {
    required("target_user", "Who this is for", 6);
    required("problem_statement", "Problem statement", 8);
    required("pain_level", "Pain level");
    required("urgency_level", "Urgency level");
    required("existing_alternatives", "Existing alternatives", 3);
    required("switching_reason", "Why they would switch", 6);
    required("demand_evidence", "Evidence of demand", 6);
  }
  if (step === 3) {
    required("location", "Location");
    required("market_scope", "Market scope");
    required("competitors", "Competitors", 3);
    required("market_saturation_estimate", "Market saturation estimate", 3);
    required("differentiation", "Differentiation", 6);
    required("market_gap", "Market gap", 6);
    required("timing_reason", "Why now", 6);
  }
  if (step === 4) {
    required("offer_description", "Offer description", 6);
    required("delivery_model", "Delivery model", 3);
    required("revenue_model", "Revenue model", 3);
    required("price_range", "Price range", 1);
    required("monetization_type", "Monetization type", 3);
    required("payment_assumption", "Payment assumption", 6);
  }
  if (step === 5) {
    required("budget", "Budget");
    required("weekly_hours", "Weekly hours");
    required("existing_skills", "Existing skills", 3);
    required("missing_skills", "Missing skills", 3);
    required("team_status", "Team status", 3);
    required("available_assets", "Available assets", 3);
    required("available_tools", "Available tools", 3);
    required("current_audience_or_customers", "Current audience or customers", 2);
  }
  if (step === 6) {
    required("launch_target_date", "Launch target date");
    required("first_result_date", "First result date");
    required("thirty_day_target", "30-day target", 6);
    required("ninety_day_target", "90-day target", 6);
    required("twelve_month_target", "12-month target", 6);
    required("work_availability", "Work availability", 3);
    required("commitment_level", "Commitment level", 3);
  }
  if (step === 7) {
    required("known_risks", "Known risks", 3);
    required("legal_constraints", "Legal constraints", 1);
    required("technical_constraints", "Technical constraints", 1);
    required("financial_constraints", "Financial constraints", 1);
    required("time_constraints", "Time constraints", 1);
    required("skill_constraints", "Skill constraints", 1);
    required("external_dependencies", "External dependencies", 1);
    required("past_attempts", "Past attempts", 3);
    required("past_failures", "Past failures", 3);
    required("unknowns", "Unknowns", 3);
  }
  if (step === 8) {
    required("strategy_preference", "Strategy preference", 3);
    required("non_negotiables", "Non-negotiables", 3);
    required("avoid_work_types", "Work to avoid", 3);
    required("repeatable_work_types", "Repeatable work", 3);
    required("minimum_success_threshold", "Minimum success threshold", 6);
  }
  if (step === 9) {
    // optional evidence section
  }
  return errors;
}

export function IntakeWizard({ session, onSessionUpdate, onComplete, completing }: Props) {
  const prefilledSections = new Set(session.sections_completed ?? []);
  const sectionPrefilled = session.prefilled_from_handoff === true;

  const initialStep = useMemo(() => {
    const cur = session.current_section;
    if (cur >= 1 && cur <= 9) return cur;
    const completed = session.sections_completed ?? [];
    if (completed.length >= 9) return 9;
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

  const progressPct = Math.round(((session.sections_completed?.length ?? 0) / 9) * 100);

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
        if (step < 9) setStep(step + 1);
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
            <Field id="project_name" label="What is the project name?" value={data.project_name ?? ""} onChange={(v) => patch("project_name", v)} disabled={disabled} error={errors.project_name} prefilled={fieldPrefilled("project_name")} />
            <Field id="project_description" label="What are you building?" value={data.project_description ?? ""} onChange={(v) => patch("project_description", v)} multiline disabled={disabled} error={errors.project_description} prefilled={fieldPrefilled("project_description")} />
            <Field id="primary_goal" label="What is the primary goal?" value={data.primary_goal ?? ""} onChange={(v) => patch("primary_goal", v)} multiline disabled={disabled} error={errors.primary_goal} />
            <Field id="project_purpose" label="Why does this project matter?" value={data.project_purpose ?? ""} onChange={(v) => patch("project_purpose", v)} multiline disabled={disabled} error={errors.project_purpose} prefilled={fieldPrefilled("project_purpose")} />
            <Field id="success_definition" label="What does success look like?" value={data.success_definition ?? ""} onChange={(v) => patch("success_definition", v)} multiline disabled={disabled} error={errors.success_definition} />
            <Field id="failure_definition" label="What would failure look like?" value={data.failure_definition ?? ""} onChange={(v) => patch("failure_definition", v)} multiline disabled={disabled} error={errors.failure_definition} />
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <Field id="target_user" label="Who is this for?" value={data.target_user ?? ""} onChange={(v) => patch("target_user", v)} multiline disabled={disabled} error={errors.target_user} />
            <Field id="problem_statement" label="What problem do they have?" value={data.problem_statement ?? ""} onChange={(v) => patch("problem_statement", v)} multiline disabled={disabled} error={errors.problem_statement} />
            <Field id="pain_level" label="How painful is the problem? (low/medium/high)" value={data.pain_level ?? ""} onChange={(v) => patch("pain_level", v)} disabled={disabled} error={errors.pain_level} />
            <Field id="urgency_level" label="How urgent is the problem? (low/medium/high)" value={data.urgency_level ?? ""} onChange={(v) => patch("urgency_level", v)} disabled={disabled} error={errors.urgency_level} />
            <Field id="existing_alternatives" label="Are they already paying for alternatives?" value={data.existing_alternatives ?? ""} onChange={(v) => patch("existing_alternatives", v)} multiline disabled={disabled} error={errors.existing_alternatives} />
            <Field id="switching_reason" label="What would make them switch or care?" value={data.switching_reason ?? ""} onChange={(v) => patch("switching_reason", v)} multiline disabled={disabled} error={errors.switching_reason} />
            <Field id="demand_evidence" label="What evidence do you already have that they want this?" value={data.demand_evidence ?? ""} onChange={(v) => patch("demand_evidence", v)} multiline disabled={disabled} error={errors.demand_evidence} />
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <Field id="location" label="Where is your market?" value={data.location ?? ""} onChange={(v) => patch("location", v)} disabled={disabled} error={errors.location} prefilled={fieldPrefilled("location")} />
            <Field id="market_scope" label="Is this local, national, global, or online?" value={data.market_scope ?? ""} onChange={(v) => patch("market_scope", v)} disabled={disabled} error={errors.market_scope} />
            <Field id="competitors" label="Who are the main competitors or alternatives?" value={data.competitors ?? ""} onChange={(v) => patch("competitors", v)} multiline disabled={disabled} error={errors.competitors} />
            <Field id="market_saturation_estimate" label="How crowded is the market?" value={data.market_saturation_estimate ?? ""} onChange={(v) => patch("market_saturation_estimate", v)} disabled={disabled} error={errors.market_saturation_estimate} />
            <Field id="differentiation" label="What makes your approach different?" value={data.differentiation ?? ""} onChange={(v) => patch("differentiation", v)} multiline disabled={disabled} error={errors.differentiation} />
            <Field id="market_gap" label="What trend or gap makes this possible now?" value={data.market_gap ?? ""} onChange={(v) => patch("market_gap", v)} multiline disabled={disabled} error={errors.market_gap} />
            <Field id="timing_reason" label="Why is this the right time?" value={data.timing_reason ?? ""} onChange={(v) => patch("timing_reason", v)} multiline disabled={disabled} error={errors.timing_reason} />
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <Field id="offer_description" label="What are you offering?" value={data.offer_description ?? ""} onChange={(v) => patch("offer_description", v)} multiline disabled={disabled} error={errors.offer_description} />
            <Field id="delivery_model" label="How will people receive the value?" value={data.delivery_model ?? ""} onChange={(v) => patch("delivery_model", v)} disabled={disabled} error={errors.delivery_model} />
            <Field id="revenue_model" label="How will this make money?" value={data.revenue_model ?? ""} onChange={(v) => patch("revenue_model", v)} disabled={disabled} error={errors.revenue_model} />
            <Field id="price_range" label="What price range are you considering?" value={data.price_range ?? ""} onChange={(v) => patch("price_range", v)} disabled={disabled} error={errors.price_range} />
            <Field id="monetization_type" label="Revenue type (one-time, recurring, service, product, hybrid)" value={data.monetization_type ?? ""} onChange={(v) => patch("monetization_type", v)} disabled={disabled} error={errors.monetization_type} />
            <Field id="payment_assumption" label="What must be true for someone to pay?" value={data.payment_assumption ?? ""} onChange={(v) => patch("payment_assumption", v)} multiline disabled={disabled} error={errors.payment_assumption} />
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <Field id="budget" label="What budget do you have?" value={data.budget ?? ""} onChange={(v) => patch("budget", v)} disabled={disabled} error={errors.budget} prefilled={fieldPrefilled("budget")} />
            <Field id="weekly_hours" label="How many hours per week can you commit?" value={data.weekly_hours ?? ""} onChange={(v) => patch("weekly_hours", v)} disabled={disabled} error={errors.weekly_hours} />
            <Field id="existing_skills" label="What skills do you already have?" value={data.existing_skills ?? ""} onChange={(v) => patch("existing_skills", v)} multiline disabled={disabled} error={errors.existing_skills} />
            <Field id="missing_skills" label="What skills are missing?" value={data.missing_skills ?? ""} onChange={(v) => patch("missing_skills", v)} multiline disabled={disabled} error={errors.missing_skills} />
            <Field id="team_status" label="Are you working alone or with a team?" value={data.team_status ?? ""} onChange={(v) => patch("team_status", v)} disabled={disabled} error={errors.team_status} />
            <Field id="available_assets" label="What assets do you already have?" value={data.available_assets ?? ""} onChange={(v) => patch("available_assets", v)} multiline disabled={disabled} error={errors.available_assets} />
            <Field id="available_tools" label="What tools or infrastructure do you already have?" value={data.available_tools ?? ""} onChange={(v) => patch("available_tools", v)} multiline disabled={disabled} error={errors.available_tools} />
            <Field id="current_audience_or_customers" label="Do you already have an audience or customers?" value={data.current_audience_or_customers ?? ""} onChange={(v) => patch("current_audience_or_customers", v)} multiline disabled={disabled} error={errors.current_audience_or_customers} />
          </div>
        );
      case 6:
        return (
          <div className="space-y-5">
            <Field id="launch_target_date" label="When do you want to launch?" value={data.launch_target_date ?? ""} onChange={(v) => patch("launch_target_date", v)} placeholder="e.g. 2026-09-01" disabled={disabled} error={errors.launch_target_date} />
            <Field id="first_result_date" label="When do you want your first real result?" value={data.first_result_date ?? ""} onChange={(v) => patch("first_result_date", v)} disabled={disabled} error={errors.first_result_date} />
            <Field id="thirty_day_target" label="What is your 30-day target?" value={data.thirty_day_target ?? ""} onChange={(v) => patch("thirty_day_target", v)} multiline disabled={disabled} error={errors.thirty_day_target} />
            <Field id="ninety_day_target" label="What is your 90-day target?" value={data.ninety_day_target ?? ""} onChange={(v) => patch("ninety_day_target", v)} multiline disabled={disabled} error={errors.ninety_day_target} />
            <Field id="twelve_month_target" label="What is your 12-month target?" value={data.twelve_month_target ?? ""} onChange={(v) => patch("twelve_month_target", v)} multiline disabled={disabled} error={errors.twelve_month_target} />
            <Field id="work_availability" label="What days or times can you realistically work?" value={data.work_availability ?? ""} onChange={(v) => patch("work_availability", v)} multiline disabled={disabled} error={errors.work_availability} />
            <Field id="commitment_level" label="How committed are you right now?" value={data.commitment_level ?? ""} onChange={(v) => patch("commitment_level", v)} disabled={disabled} error={errors.commitment_level} />
          </div>
        );
      case 7:
        return (
          <div className="space-y-5">
            <Field id="known_risks" label="What could stop this from working?" value={data.known_risks ?? ""} onChange={(v) => patch("known_risks", v)} multiline disabled={disabled} error={errors.known_risks} />
            <Field id="legal_constraints" label="Legal constraints (if any)" value={data.legal_constraints ?? ""} onChange={(v) => patch("legal_constraints", v)} multiline disabled={disabled} error={errors.legal_constraints} />
            <Field id="technical_constraints" label="Technical constraints" value={data.technical_constraints ?? ""} onChange={(v) => patch("technical_constraints", v)} multiline disabled={disabled} error={errors.technical_constraints} />
            <Field id="financial_constraints" label="Financial constraints" value={data.financial_constraints ?? ""} onChange={(v) => patch("financial_constraints", v)} multiline disabled={disabled} error={errors.financial_constraints} />
            <Field id="time_constraints" label="Time constraints" value={data.time_constraints ?? ""} onChange={(v) => patch("time_constraints", v)} multiline disabled={disabled} error={errors.time_constraints} />
            <Field id="skill_constraints" label="Skill constraints" value={data.skill_constraints ?? ""} onChange={(v) => patch("skill_constraints", v)} multiline disabled={disabled} error={errors.skill_constraints} />
            <Field id="external_dependencies" label="External dependencies" value={data.external_dependencies ?? ""} onChange={(v) => patch("external_dependencies", v)} multiline disabled={disabled} error={errors.external_dependencies} />
            <Field id="past_attempts" label="What have you already tried?" value={data.past_attempts ?? ""} onChange={(v) => patch("past_attempts", v)} multiline disabled={disabled} error={errors.past_attempts} />
            <Field id="past_failures" label="What failed before?" value={data.past_failures ?? ""} onChange={(v) => patch("past_failures", v)} multiline disabled={disabled} error={errors.past_failures} />
            <Field id="unknowns" label="What do you not know yet?" value={data.unknowns ?? ""} onChange={(v) => patch("unknowns", v)} multiline disabled={disabled} error={errors.unknowns} />
          </div>
        );
      case 8:
        return (
          <div className="space-y-5">
            <Field id="strategy_preference" label="Which path do you prefer (fastest/safest/highest growth/long-term system)?" value={data.strategy_preference ?? ""} onChange={(v) => patch("strategy_preference", v)} disabled={disabled} error={errors.strategy_preference} />
            <Field id="non_negotiables" label="What are you unwilling to do?" value={data.non_negotiables ?? ""} onChange={(v) => patch("non_negotiables", v)} multiline disabled={disabled} error={errors.non_negotiables} />
            <Field id="avoid_work_types" label="What kind of work do you want to avoid?" value={data.avoid_work_types ?? ""} onChange={(v) => patch("avoid_work_types", v)} multiline disabled={disabled} error={errors.avoid_work_types} />
            <Field id="repeatable_work_types" label="What work are you willing to repeat consistently?" value={data.repeatable_work_types ?? ""} onChange={(v) => patch("repeatable_work_types", v)} multiline disabled={disabled} error={errors.repeatable_work_types} />
            <Field id="minimum_success_threshold" label="What is the minimum result that makes this worth continuing?" value={data.minimum_success_threshold ?? ""} onChange={(v) => patch("minimum_success_threshold", v)} multiline disabled={disabled} error={errors.minimum_success_threshold} />
          </div>
        );
      case 9:
        return (
          <div className="space-y-5">
            <Field id="evidence_links" label="Evidence links (optional)" value={data.evidence_links ?? ""} onChange={(v) => patch("evidence_links", v)} multiline disabled={disabled} />
            <Field id="analytics_notes" label="Analytics notes (optional)" value={data.analytics_notes ?? ""} onChange={(v) => patch("analytics_notes", v)} multiline disabled={disabled} />
            <Field id="customer_feedback" label="Customer feedback (optional)" value={data.customer_feedback ?? ""} onChange={(v) => patch("customer_feedback", v)} multiline disabled={disabled} />
            <Field id="revenue_proof" label="Revenue proof (optional)" value={data.revenue_proof ?? ""} onChange={(v) => patch("revenue_proof", v)} multiline disabled={disabled} />
            <Field id="audience_proof" label="Audience proof (optional)" value={data.audience_proof ?? ""} onChange={(v) => patch("audience_proof", v)} multiline disabled={disabled} />
            <Field id="competitor_references" label="Competitor references (optional)" value={data.competitor_references ?? ""} onChange={(v) => patch("competitor_references", v)} multiline disabled={disabled} />
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
          {step < 9 ? (saving ? "Saving…" : "Save & continue") : completing ? "Submitting…" : "Submit intake"}
        </button>
      </div>
    </div>
  );
}
