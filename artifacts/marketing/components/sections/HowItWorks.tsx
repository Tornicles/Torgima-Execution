"use client";

import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";

const steps = [
  {
    title: "Set your goal",
    body: "Enter your goal, purpose, and timeframe. Torgima validates it and builds your execution structure.",
    icon: (
      <svg viewBox="0 0 48 48" className="w-10 h-10 text-[var(--color-accent-blue)]" aria-hidden>
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <circle cx="24" cy="24" r="3" fill="currentColor" />
        <line x1="24" y1="4" x2="24" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="24" y1="34" x2="24" y2="44" stroke="currentColor" strokeWidth="1.5" />
        <line x1="4" y1="24" x2="14" y2="24" stroke="currentColor" strokeWidth="1.5" />
        <line x1="34" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Get your plan",
    body: "Your goal becomes a structured blueprint: phases, projects, and daily tasks — personalized to you.",
    icon: (
      <svg viewBox="0 0 48 48" className="w-10 h-10 text-[var(--color-accent-blue)]" aria-hidden>
        <rect x="8" y="8" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="8" y="22" width="10" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
        <rect x="8" y="34" width="8" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <path d="M22 12h6M22 25h8M22 37h10" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    title: "Execute every day",
    body: "Torgima gives you the next correct task, reads your progress, and adapts. The system never goes empty.",
    icon: (
      <svg viewBox="0 0 48 48" className="w-10 h-10 text-[var(--color-accent-blue)]" aria-hidden>
        <path d="M38 14c-10 4-16 12-18 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 34c6-4 12-6 20-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <path d="M18 28l3 4 7-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="py-section-sm lg:py-section px-4 bg-[var(--color-black)] border-t border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUpVariants}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="font-syne font-bold text-3xl sm:text-4xl text-[var(--color-text-primary)]">
            Three steps. One system. Continuous execution.
          </h2>
          <p className="mt-4 font-dm text-[var(--color-text-secondary)] text-lg">
            Most people plan but never execute. Torgima closes that gap.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-4 relative">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ delay: i * 0.15, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative px-2"
            >
              <span className="font-jet font-bold text-[72px] leading-none text-[var(--color-border-hover)] select-none absolute -top-4 left-0 opacity-40 z-0">
                {i + 1}
              </span>
              <div className="relative z-10 pt-10">
                <div className="mb-5">{s.icon}</div>
                <h3 className="font-syne font-bold text-[22px] text-[var(--color-text-primary)] mb-2">{s.title}</h3>
                <p className="font-dm text-[15px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">{s.body}</p>
              </div>
              {i < steps.length - 1 ? (
                <div
                  className="hidden md:block absolute top-24 -right-2 w-1/2 h-px border-t border-dashed border-[var(--color-border)] translate-x-1/2 z-0"
                  aria-hidden
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-[10px]">→</span>
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
