import { useMemo, useState } from "react";
import {
  BUDGET_RANGE_OPTIONS,
  INDUSTRY_SUGGESTIONS,
  TIMELINE_OPTIONS,
  type FreeValidatePayload,
} from "@/lib/erector-free-api";
import { ERECTOR_LABELS } from "@/lib/language-map";

export type FreeIntakeValues = Omit<FreeValidatePayload, "fingerprint">;

type Props = {
  disabled?: boolean;
  onSubmit: (values: FreeIntakeValues) => void;
};

export function FreeIntakeForm({ disabled, onSubmit }: Props) {
  const [industry, setIndustry] = useState("");
  const [industryPreset, setIndustryPreset] = useState("");
  const [location, setLocation] = useState("");
  const [budgetRange, setBudgetRange] = useState<FreeIntakeValues["budget_range"]>("1k_5k");
  const [timeline, setTimeline] = useState<FreeIntakeValues["timeline"]>("3_months");
  const [additionalContext, setAdditionalContext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resolvedIndustry = useMemo(() => {
    if (industryPreset && industryPreset !== "Other") return industryPreset;
    return industry.trim();
  }, [industry, industryPreset]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!resolvedIndustry) next.industry = "Tell us what kind of business or project this is.";
    if (!location.trim()) next.location = "Tell us where you are based.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      industry: resolvedIndustry,
      location: location.trim(),
      budget_range: budgetRange,
      timeline,
      additional_context: additionalContext.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm font-bold uppercase tracking-wide text-[#0EA5E9]">{ERECTOR_LABELS.erector_free}</p>
      <div>
        <label className="block text-sm font-semibold text-[#0A0F1E]" htmlFor="industry-preset">
          What kind of business or project is this?
        </label>
        <select
          id="industry-preset"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={industryPreset}
          onChange={(e) => setIndustryPreset(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select a category (optional)</option>
          {INDUSTRY_SUGGESTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          id="industry"
          type="text"
          placeholder="Describe your project in your own words"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          disabled={disabled}
        />
        {errors.industry ? <p className="mt-1 text-sm text-red-600">{errors.industry}</p> : null}
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#0A0F1E]" htmlFor="location">
          Where are you based?
        </label>
        <input
          id="location"
          type="text"
          placeholder="Country or region"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={disabled}
        />
        {errors.location ? <p className="mt-1 text-sm text-red-600">{errors.location}</p> : null}
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#0A0F1E]" htmlFor="budget">
          What is your starting budget?
        </label>
        <select
          id="budget"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={budgetRange}
          onChange={(e) => setBudgetRange(e.target.value as FreeIntakeValues["budget_range"])}
          disabled={disabled}
        >
          {BUDGET_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#0A0F1E]" htmlFor="timeline">
          When do you want to see results by?
        </label>
        <select
          id="timeline"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={timeline}
          onChange={(e) => setTimeline(e.target.value as FreeIntakeValues["timeline"])}
          disabled={disabled}
        >
          {TIMELINE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#0A0F1E]" htmlFor="context">
          Any additional context? <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="context"
          rows={4}
          maxLength={500}
          placeholder="Share anything else that helps us understand your project."
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-gray-500">{additionalContext.length}/500</p>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-full bg-[#0EA5E9] px-6 py-4 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-60"
      >
        Analyze My Project
      </button>
    </form>
  );
}
