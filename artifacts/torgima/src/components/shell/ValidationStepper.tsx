const STEPS = [
  { n: 1, title: "Input Details", sub: "Your goal & context" },
  { n: 2, title: "Validation", sub: "We check reality" },
  { n: 3, title: "Results", sub: "Get your direction" },
  { n: 4, title: "Launch", sub: "Build & execute" },
] as const;

export function ValidationStepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 py-5 border-b border-gray-100 bg-white">
      {STEPS.map((step, i) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <div key={step.n} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-emerald-600 text-white"
                      : "border-2 border-gray-200 text-gray-400 bg-white"
                }`}
              >
                {done ? "✓" : step.n}
              </span>
              <div className="hidden sm:block">
                <p className={`text-xs font-bold uppercase tracking-wide ${active ? "text-emerald-700" : "text-gray-500"}`}>
                  {step.title}
                </p>
                <p className="text-[10px] text-gray-400">{step.sub}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && <div className="w-8 sm:w-12 h-px bg-gray-200 hidden sm:block" />}
          </div>
        );
      })}
    </nav>
  );
}
