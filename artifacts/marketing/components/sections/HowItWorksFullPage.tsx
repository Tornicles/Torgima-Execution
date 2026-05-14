"use client";

import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";

const conditions = ["Nothingness", "Danger", "Urgency", "Stability", "Power", "Affluence"];

export function HowItWorksFullPage() {
  return (
    <div className="py-section-sm lg:py-section px-4 max-w-4xl mx-auto space-y-section-sm lg:space-y-section">
      <motion.header initial="hidden" animate="visible" variants={fadeUpVariants} className="max-w-3xl">
        <h1 className="font-syne font-extrabold text-4xl sm:text-5xl text-[var(--color-text-primary)]">How execution runs</h1>
        <p className="mt-4 font-dm text-lg text-[var(--color-text-secondary)]">
          A walkthrough of the loop: goal → validation → blueprint → daily tasks → signals → adaptation.
        </p>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8"
      >
        <h2 className="font-syne font-bold text-2xl text-[var(--color-text-primary)] mb-4">1. You start with a goal</h2>
        <p className="font-dm text-[var(--color-text-secondary)] leading-relaxed mb-6">
          You enter the goal, purpose, and timeframe. The inputs are simple. The structure they produce is not.
        </p>
        <div className="space-y-3 max-w-md mx-auto">
          {["Primary goal", "Purpose", "Target window"].map((label) => (
            <div key={label} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 font-dm text-sm text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-muted)] text-xs font-jet uppercase tracking-wider block mb-1">{label}</span>
              <div className="h-2 rounded bg-[var(--color-surface-3)] w-3/4" />
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8"
      >
        <h2 className="font-syne font-bold text-2xl text-[var(--color-text-primary)] mb-4">2. Validation decides your path</h2>
        <p className="font-dm text-[var(--color-text-secondary)] leading-relaxed mb-6">
          Three paths: proceed on the current framing, adjust scope, or pivot to an alternative. Each path is explicit.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {["Current", "Adjusted", "Alternative"].map((p, i) => (
            <div
              key={p}
              className={`rounded-[var(--radius-md)] border p-4 font-dm text-sm ${
                i === 0
                  ? "border-[var(--color-accent-purple)] bg-[var(--color-accent-glow)] text-[var(--color-text-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              <p className="font-jet text-[10px] uppercase tracking-wider mb-2">Path</p>
              <p className="font-syne font-semibold">{p}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8"
      >
        <h2 className="font-syne font-bold text-2xl text-[var(--color-text-primary)] mb-4">3. Your blueprint is built</h2>
        <p className="font-dm text-[var(--color-text-secondary)] leading-relaxed mb-6">
          Goal → Plans → Phases → Projects → Actions → Tasks. Traceability is fixed at every layer.
        </p>
        <div className="flex flex-col gap-2 max-w-xs mx-auto font-jet text-[11px] text-[var(--color-text-secondary)]">
          {["Goal", "Plans", "Phases", "Projects", "Actions", "Tasks"].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-6 text-[var(--color-text-muted)]">{i + 1}</span>
              <div className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 bg-[var(--color-surface-1)] opacity-[calc(1-i*0.08)]">
                {label}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8"
      >
        <h2 className="font-syne font-bold text-2xl text-[var(--color-text-primary)] mb-4">4. The execution loop runs</h2>
        <p className="font-dm text-[var(--color-text-secondary)] leading-relaxed mb-6">
          Task → Execute → Feedback → Signal → Condition → Next task. The cycle does not skip steps.
        </p>
        <div className="flex justify-center py-4">
          <svg viewBox="0 0 200 200" className="w-56 h-56 text-[var(--color-accent-purple)]" aria-hidden>
            <circle cx="100" cy="100" r="78" stroke="currentColor" fill="none" strokeWidth="1.2" opacity="0.3" />
            {["Task", "Execute", "Feedback", "Signal", "Condition", "New task"].map((label, i) => {
              const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
              const x = 100 + Math.cos(a) * 62;
              const y = 100 + Math.sin(a) * 62;
              return (
                <g key={label}>
                  <circle cx={x} cy={y} r="18" fill="var(--color-surface-1)" stroke="currentColor" strokeWidth="1" />
                  <text x={x} y={y + 3} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="7" fontFamily="monospace">
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8"
      >
        <h2 className="font-syne font-bold text-2xl text-[var(--color-text-primary)] mb-4">5. The system adapts</h2>
        <p className="font-dm text-[var(--color-text-secondary)] leading-relaxed mb-6">
          Signals move your condition across a spectrum. Your condition changes workload, difficulty, and advancement rules.
        </p>
        <div className="relative h-14 rounded-full border border-[var(--color-border)] bg-gradient-to-r from-[#2a1f3d] via-[#1a2740] to-[#1f2a32] overflow-hidden">
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between items-center font-jet text-[9px] sm:text-[10px] text-[var(--color-text-muted)] px-1">
            {conditions.map((c) => (
              <span key={c} className="text-center max-w-[52px] leading-tight">
                {c}
              </span>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
}
