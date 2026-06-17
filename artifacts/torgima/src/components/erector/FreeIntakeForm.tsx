import { useMemo, useState } from "react";
import {
  BUDGET_RANGE_OPTIONS,
  INDUSTRY_SUGGESTIONS,
  TIMELINE_OPTIONS,
  type FreeValidatePayload,
} from "@/lib/erector-free-api";
import { ERECTOR_LABELS } from "@/lib/language-map";

export type FreeIntakeValues = Omit<FreeValidatePayload, "fingerprint" | "anonymous_session_id">;

type Props = {
  disabled?: boolean;
  onSubmit: (values: FreeIntakeValues) => void;
};

export function FreeIntakeForm({ disabled, onSubmit }: Props) {
  const [ideaOrGoal, setIdeaOrGoal] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryPreset, setIndustryPreset] = useState("");
  const [location, setLocation] = useState("");
  const [budgetRange, setBudgetRange] = useState("1k_5k");
  const [timeline, setTimeline] = useState("90 days");
  const [additionalContext, setAdditionalContext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resolvedIndustry = useMemo(() => {
    if (industryPreset && industryPreset !== "Other") return industryPreset;
    return industry.trim();
  }, [industry, industryPreset]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!ideaOrGoal.trim() || ideaOrGoal.trim().length < 10) {
      next.idea_or_goal = "Describe your idea in at least 10 characters.";
    }
    if (!resolvedIndustry) {
      next.industry_or_domain = "Tell us what industry or domain this fits.";
    }
    if (!location.trim()) next.location = "Tell us where you are based.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      idea_or_goal: ideaOrGoal.trim(),
      industry_or_domain: resolvedIndustry,
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
        <label className="block text-sm font-semibold text-[#0A0F1E]" htmlFor="idea">
          What do you want to build or achieve?
        </label>
        <textarea
          id="idea"
          rows={3}
          maxLength={500}
          placeholder="e.g. I want to create a fitness content brand for beginners"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={ideaOrGoal}
          onChange={(e) => setIdeaOrGoal(e.target.value)}
          disabled={disabled}
        />
        {errors.idea_or_goal ? <p className="mt-1 text-sm text-red-600">{errors.idea_or_goal}</p> : null}
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#0A0F1E]" htmlFor="industry-preset">
          Industry or domain
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
          placeholder="Or type your industry / domain"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          disabled={disabled}
        />
        {errors.industry_or_domain ? (
          <p className="mt-1 text-sm text-red-600">{errors.industry_or_domain}</p>
        ) : null}
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
          Starting budget
        </label>
        <select
          id="budget"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={budgetRange}
          onChange={(e) => setBudgetRange(e.target.value)}
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
          Target timeline
        </label>
        <select
          id="timeline"
          className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
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
        Run Free Validation
      </button>
    </form>
  );
}
