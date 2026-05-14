"use client";

import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";

const rows: [string, string][] = [
  ["Static task lists", "Dynamic execution blueprint"],
  ["Manual daily planning", "AI-generated daily tasks"],
  ["No adaptation when you fall behind", "Recalibrates automatically"],
  ["No context for why tasks matter", "Every task explains its purpose"],
  ["Completion requires willpower only", "System detects friction and recovers"],
  ["Flat difficulty forever", "Task difficulty scales with capability"],
  ["No goal-to-task traceability", "Full chain from goal → task"],
  ["Just a tool", "A complete execution system"],
];

export function Differentiation() {
  return (
    <section className="py-section-sm lg:py-section px-4 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUpVariants}
          className="mb-12 text-center lg:text-left"
        >
          <h2 className="font-syne font-bold text-3xl sm:text-4xl text-[var(--color-text-primary)]">Not another task app.</h2>
          <p className="mt-4 font-dm text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto lg:mx-0">
            Traditional productivity tools give you lists. Torgima gives you a system that executes.
          </p>
        </motion.div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
          <div className="grid grid-cols-2 gap-0 bg-[var(--color-surface-2)] font-syne font-bold text-sm sm:text-base tracking-tight border-b border-[var(--color-border)]">
            <div className="p-4 text-[var(--color-text-muted)]">Traditional Tools</div>
            <div className="p-4 text-[var(--color-accent-blue)] font-jet tracking-wider">TORGIMA</div>
          </div>
          {rows.map(([left, right], i) => (
            <motion.div
              key={left}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.05 }}
              transition={{ delay: (i % 4) * 0.04, duration: 0.35 }}
              className={`grid grid-cols-2 gap-0 border-b border-[var(--color-border)] last:border-0 ${
                i % 2 === 0 ? "bg-[var(--color-surface-1)]" : "bg-[var(--color-surface-2)]"
              }`}
            >
              <div className="p-4 font-dm text-sm text-[var(--color-text-secondary)] flex gap-2 items-start">
                <span className="text-red-400/80 shrink-0">✗</span>
                <span>{left}</span>
              </div>
              <div className="p-4 font-dm text-sm text-[var(--color-text-primary)] flex gap-2 items-start">
                <span className="text-[var(--color-accent-blue)] shrink-0">✓</span>
                <span>{right}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
