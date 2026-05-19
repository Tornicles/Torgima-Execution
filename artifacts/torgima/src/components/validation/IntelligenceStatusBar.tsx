import { ValidationStatus } from "@workspace/state-machine";

const SYSTEMS = ["CIS", "IIS", "EIS", "SIS", "PIS"] as const;

const labels: Record<string, string> = {
  CIS: "Context",
  IIS: "Goal refinement",
  EIS: "Industry research",
  SIS: "Strategic paths",
  PIS: "Positioning",
};

export function IntelligenceStatusBar({
  progress,
}: {
  progress?: Record<string, ValidationStatus>;
}) {
  if (!progress) return null;

  return (
    <div className="flex flex-wrap gap-2" role="status" aria-label="Intelligence systems progress">
      {SYSTEMS.map((key) => {
        const state = progress[key] ?? ValidationStatus.PENDING;
        const cls =
          state === ValidationStatus.COMPLETE ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
          : state === ValidationStatus.RUNNING ? "bg-sky-50 text-sky-800 ring-sky-200 animate-pulse"
          : "bg-gray-50 text-gray-500 ring-gray-200";
        return (
          <span
            key={key}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${cls}`}
          >
            {labels[key] ?? key}: {state}
          </span>
        );
      })}
    </div>
  );
}
