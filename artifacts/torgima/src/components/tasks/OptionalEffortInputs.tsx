import { LANGUAGE } from "@/lib/language";
import type { FeedbackFormState } from "@/types/task-execution";

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (n: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-[#64748B]">{label}</span>
      <div className="flex gap-1">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-8 w-8 rounded-lg text-sm font-bold ${
              value === n ? "bg-[#5B21FF] text-white" : "bg-[#F1F5F9] text-[#64748B]"
            }`}
            aria-label={`${n} of 5`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OptionalEffortInputs({
  form,
  onChange,
}: {
  form: FeedbackFormState;
  onChange: (patch: Partial<FeedbackFormState>) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-[#ECECF4] bg-[#FAFAFC] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
        {LANGUAGE.feedback.optionalContext}
      </p>
      <StarRow
        label={LANGUAGE.feedback.effortLabel}
        value={form.effortScore}
        onChange={(n) => onChange({ effortScore: n })}
      />
      <StarRow
        label={LANGUAGE.feedback.frictionLabel}
        value={form.frictionScore}
        onChange={(n) => onChange({ frictionScore: n })}
      />
      <StarRow
        label={LANGUAGE.feedback.confidenceLabel}
        value={form.confidenceScore}
        onChange={(n) => onChange({ confidenceScore: n })}
      />
      <label className="block text-xs text-[#64748B]">{LANGUAGE.feedback.durationLabel}</label>
      <input
        type="number"
        min={1}
        max={480}
        value={form.durationMinutes ?? ""}
        onChange={(e) =>
          onChange({
            durationMinutes: e.target.value ? Number(e.target.value) : undefined,
          })
        }
        className="w-full max-w-[8rem] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
      />
      <textarea
        value={form.userNotes ?? ""}
        onChange={(e) => onChange({ userNotes: e.target.value })}
        rows={2}
        placeholder={LANGUAGE.feedback.notesPlaceholder}
        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
      />
    </div>
  );
}
