import { Check } from "lucide-react";

const STEPS = [
  { n: 1, label: "Goal & Purpose", doneLabel: "Goal & Purpose ✓" },
  { n: 2, label: "Context & Timeframe", doneLabel: "Context & Timeframe ✓" },
  { n: 3, label: "Review" },
  { n: 4, label: "Validate Idea" },
] as const;

export function PreValidationStepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav
      className="mx-auto flex max-w-4xl items-center justify-center gap-0 px-4"
      aria-label="Pre-validation progress"
    >
      {STEPS.map((step, index) => {
        const active = step.n === current;
        const done = step.n < current;
        return (
          <div key={step.n} className="flex flex-1 items-center">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  active
                    ? "bg-[#5B21FF] text-white shadow-md shadow-violet-200"
                    : done
                      ? "bg-[#5B21FF] text-white"
                      : "border border-[#E2E8F0] bg-white text-[#64748B]"
                }`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : step.n}
              </span>
              <span
                className={`text-center text-[11px] font-semibold leading-tight sm:text-xs ${
                  active || done ? "text-[#5B21FF]" : "text-[#64748B]"
                }`}
              >
                {done && "doneLabel" in step ? step.doneLabel : step.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <div
                className={`mx-1 mb-6 h-px flex-1 sm:mx-2 ${
                  step.n < current ? "bg-[#5B21FF]/50" : "bg-[#E2E8F0]"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/** @deprecated Use PreValidationStepper */
export const GoalPurposeStepper = PreValidationStepper;
