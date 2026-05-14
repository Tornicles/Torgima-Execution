export const marketingFeatures = [
  {
    id: "validation",
    title: "Goal Validation",
    description:
      "We don't just accept your goal. We validate it. Is it clear, measurable, realistic, and executable? You get three paths: proceed, adjust, or pivot.",
    svg: (
      <svg viewBox="0 0 200 120" className="w-full h-auto text-[var(--color-accent-blue)]" aria-hidden>
        <path d="M40 85 L70 55 L95 72 L155 38" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        <circle cx="70" cy="55" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="100" y="35" width="70" height="40" rx="6" stroke="currentColor" strokeWidth="1.5" fill="rgba(124,92,252,0.06)" />
        <path d="M112 55 h46M112 65 h32" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: "blueprint",
    title: "Execution Blueprint",
    description:
      "Your validated goal becomes a full execution map: Plans → Phases → Projects → Actions → Daily Tasks. Every task traces back to your goal.",
    svg: (
      <svg viewBox="0 0 200 120" className="w-full h-auto text-[var(--color-accent-blue)]" aria-hidden>
        <rect x="70" y="12" width="60" height="14" rx="4" stroke="currentColor" fill="none" />
        <path d="M100 26 v12" stroke="currentColor" />
        <rect x="50" y="38" width="40" height="12" rx="3" stroke="currentColor" fill="none" opacity="0.8" />
        <rect x="110" y="38" width="40" height="12" rx="3" stroke="currentColor" fill="none" opacity="0.8" />
        <path d="M70 50 v10M130 50 v10" stroke="currentColor" opacity="0.6" />
        <rect x="30" y="62" width="36" height="10" rx="2" stroke="currentColor" fill="none" opacity="0.5" />
        <rect x="82" y="62" width="36" height="10" rx="2" stroke="currentColor" fill="none" opacity="0.5" />
        <rect x="134" y="62" width="36" height="10" rx="2" stroke="currentColor" fill="none" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "tasks",
    title: "Intelligent Task Generation",
    description:
      "Tasks are never random. The system reads your blueprint position, current performance, domain, and capability to generate the exact right next task.",
    svg: (
      <svg viewBox="0 0 200 120" className="w-full h-auto text-[var(--color-accent-blue)]" aria-hidden>
        <rect x="40" y="25" width="120" height="70" rx="8" stroke="currentColor" fill="rgba(79,140,255,0.05)" />
        <rect x="55" y="42" width="90" height="8" rx="2" fill="currentColor" opacity="0.3" />
        <rect x="55" y="58" width="70" height="8" rx="2" fill="currentColor" opacity="0.2" />
        <circle cx="160" cy="40" r="14" stroke="currentColor" fill="none" />
        <path d="M154 40 l4 4 8-10" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    id: "feedback",
    title: "Feedback Loop",
    description:
      "After every task, you submit a completion signal. Score, reflection, and proof if required. The system reads this to determine your real progress.",
    svg: (
      <svg viewBox="0 0 200 120" className="w-full h-auto text-[var(--color-accent-blue)]" aria-hidden>
        <path d="M50 60 h100" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="50" cy="60" r="8" fill="var(--color-surface-2)" stroke="currentColor" />
        <circle cx="150" cy="60" r="8" fill="var(--color-surface-2)" stroke="currentColor" />
        <path d="M90 35 Q100 20 110 35" stroke="currentColor" fill="none" />
        <path d="M90 85 Q100 100 110 85" stroke="currentColor" fill="none" />
      </svg>
    ),
  },
  {
    id: "signals",
    title: "Signal Engine",
    description:
      "Six performance signals — completion rate, score, momentum, trend, confidence, and consistency — combine to determine your execution state.",
    svg: (
      <svg viewBox="0 0 200 120" className="w-full h-auto text-[var(--color-accent-blue)]" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={45 + i * 18} y={80 - i * 8} width="10" height={20 + i * 8} rx="2" fill="currentColor" opacity={0.15 + i * 0.12} />
        ))}
      </svg>
    ),
  },
  {
    id: "adaptive",
    title: "Adaptive Control",
    description:
      "Your execution state controls everything: how many tasks you get, how hard they are, whether you can advance or need to recover. The system protects you from yourself.",
    svg: (
      <svg viewBox="0 0 200 120" className="w-full h-auto text-[var(--color-accent-blue)]" aria-hidden>
        <rect x="50" y="35" width="100" height="50" rx="8" stroke="currentColor" fill="none" />
        <circle cx="100" cy="60" r="12" stroke="currentColor" fill="rgba(124,92,252,0.15)" />
        <path d="M100 48 v24M88 60 h24" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "recovery",
    title: "Recovery System",
    description:
      "Miss tasks? Fall behind? The system detects it, reduces load, generates recovery tasks, and gets you back without judgment.",
    svg: (
      <svg viewBox="0 0 200 120" className="w-full h-auto text-[var(--color-accent-blue)]" aria-hidden>
        <path d="M55 85 Q55 35 130 55 Q170 62 155 92" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
        <path d="M145 82 l10 10 8-22" stroke="currentColor" fill="none" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "academy",
    title: "Academy",
    description:
      "When your execution reveals a knowledge gap, Torgima generates learning tasks connected to your live goal. No passive courses — applied learning only.",
    svg: (
      <svg viewBox="0 0 200 120" className="w-full h-auto text-[var(--color-accent-blue)]" aria-hidden>
        <path d="M100 28 l55 28-55 28-55-28 Z" stroke="currentColor" fill="rgba(124,92,252,0.06)" strokeWidth="1.5" />
        <path d="M45 56 v36 l55 22 55-22V56" stroke="currentColor" fill="none" strokeWidth="1.5" />
        <path d="M115 92 l20 14" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      </svg>
    ),
  },
] as const;
