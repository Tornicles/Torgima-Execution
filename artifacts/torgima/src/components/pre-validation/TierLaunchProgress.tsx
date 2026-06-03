import { useEffect, useState } from "react";

const STEPS = [
  "Creating plans…",
  "Creating targets…",
  "Creating phases…",
  "Initializing signals…",
  "Generating your first tasks…",
] as const;

export function TierLaunchProgress({ active }: { active: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setStepIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, 900);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
        <h2 className="mt-6 text-xl font-bold text-[#0B1220]">Building your execution system</h2>
        <p className="mt-2 text-sm text-[#64748B]">This usually takes a few seconds.</p>
        <ul className="mt-8 space-y-2 text-left text-sm text-[#475569]">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-2 ${i <= stepIndex ? "text-[#5B21FF] font-semibold" : "text-[#94A3B8]"}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${i <= stepIndex ? "bg-[#5B21FF]" : "bg-[#E2E8F0]"}`}
              />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
