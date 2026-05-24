import { useLocation } from "wouter";

export type FlowStepId = 1 | 2 | 3 | 4;

const STEPS: { id: FlowStepId; label: string; route: string | null }[] = [
  { id: 1, label: "Goal", route: "/onboarding" },
  { id: 2, label: "Validation", route: "/onboarding" },
  { id: 3, label: "Blueprint", route: null },
  { id: 4, label: "Launch", route: null },
];

export function TopProgressRail({
  currentStep,
  maxReachableStep = currentStep,
  onStepClick,
}: {
  currentStep: FlowStepId;
  /** Highest step the user may navigate back to (completed steps). */
  maxReachableStep?: FlowStepId;
  onStepClick?: (step: FlowStepId) => void;
}) {
  const [, setLocation] = useLocation();
  const reachable = maxReachableStep ?? currentStep;

  return (
    <nav
      className="flex items-center justify-center gap-1 sm:gap-2 py-4 px-4 border-b border-gray-100 bg-white"
      aria-label="Onboarding progress"
    >
      {STEPS.map((step, index) => {
        const completed = step.id < currentStep;
        const active = step.id === currentStep;
        const locked = step.id > reachable;
        const clickable = !locked && step.id < currentStep && (step.route || onStepClick);

        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={locked || (!clickable && !active)}
              onClick={() => {
                if (locked) return;
                if (onStepClick) {
                  onStepClick(step.id);
                  return;
                }
                if (clickable && step.route) setLocation(step.route);
              }}
              className={`flex items-center gap-2 rounded-lg px-1 sm:px-2 py-1 transition-colors ${
                clickable ? "cursor-pointer hover:bg-gray-50" : locked ? "cursor-default" : "cursor-default"
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  completed
                    ? "bg-green-500 text-white"
                    : active
                      ? "bg-violet-600 text-white"
                      : locked
                        ? "border-2 border-gray-200 text-gray-300 bg-white"
                        : "border-2 border-gray-300 text-gray-400 bg-white"
                }`}
              >
                {completed ? "✓" : step.id}
              </span>
              <span
                className={`text-xs sm:text-sm hidden sm:inline ${
                  active ? "font-bold text-gray-900" : completed ? "text-gray-500" : "text-gray-300"
                }`}
              >
                {step.label}
              </span>
            </button>
            {index < STEPS.length - 1 && <span className="text-gray-300 text-sm px-0.5">→</span>}
          </div>
        );
      })}
    </nav>
  );
}
