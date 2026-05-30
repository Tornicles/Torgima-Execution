import { Check } from "lucide-react";

const STEPS = [
  { n: 1, label: "Goal & Purpose" },
  { n: 2, label: "Context & Timeframe" },
  { n: 3, label: "Review" },
  { n: 4, label: "Validate Idea" },
  { n: 5, label: "Launch Blueprint" },
] as const;

export function BlueprintLaunchStepper() {
  return (
    <nav
      className="mx-auto flex max-w-4xl items-center justify-center gap-0 px-4"
      aria-label="Validation and launch progress"
    >
      {STEPS.map((step, index) => {
        const done = step.n < 5;
        const active = step.n === 5;
        return (
          <div key={step.n} className="flex flex-1 items-center">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
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
                } ${active ? "underline decoration-2 underline-offset-4" : ""}`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <div className={`mx-1 mb-6 h-px flex-1 sm:mx-2 ${done ? "bg-[#5B21FF]/50" : "bg-[#E2E8F0]"}`} />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
