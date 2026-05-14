"use client";

import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";
import { BrandMark } from "@/components/BrandLogo";

export function ProductPreview() {
  return (
    <section className="relative py-section-sm lg:py-section px-4 border-t border-[var(--color-border)] bg-[var(--color-black)] overflow-hidden">
      <div className="pointer-events-none absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[var(--color-black)] to-transparent z-10" />
      <div className="max-w-panel mx-auto relative z-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUpVariants}
          className="text-center mb-12"
        >
          <h2 className="font-syne font-bold text-3xl sm:text-4xl text-[var(--color-text-primary)]">
            Your execution system, in real time.
          </h2>
          <p className="mt-4 font-dm text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto">
            See your goal progress, active tasks, and adaptive signals — all in one calm interface.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden flex flex-col lg:flex-row min-h-[420px]"
        >
          <aside className="lg:w-[200px] border-b lg:border-b-0 lg:border-r border-[var(--color-border)] p-4 flex flex-row lg:flex-col gap-4 lg:gap-2 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-2 mb-2 lg:mb-6 shrink-0">
              <BrandMark size={28} />
            </div>
            {["Dashboard", "My Goal", "Tasks", "Progress", "Settings"].map((item, i) => (
              <div
                key={item}
                className={`font-dm text-sm px-3 py-2 rounded-md border-l-2 whitespace-nowrap shrink-0 ${
                  i === 0
                    ? "border-[var(--color-accent-purple)] bg-[var(--color-accent-glow)] text-[var(--color-text-primary)]"
                    : "border-transparent text-[var(--color-text-muted)]"
                }`}
              >
                {item}
              </div>
            ))}
            <div className="flex-1 hidden lg:block" />
            <div className="hidden lg:flex items-center gap-2 mt-auto pt-4">
              <span className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] opacity-60" />
              <p className="font-jet text-[10px] text-[var(--color-text-muted)]">Starter Plan</p>
            </div>
          </aside>

          <div className="flex-1 p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
              <p className="font-dm text-sm text-[var(--color-text-secondary)]">Today · Thursday</p>
              <span className="font-jet text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                STABILITY
              </span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-6">
              {[
                ["Tasks Done", "3 / 4"],
                ["Score", "8.2"],
                ["Momentum", "↑ Rising"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                  <p className="font-jet text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{k}</p>
                  <p className="font-syne font-bold text-lg mt-1">{v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 mb-4">
              <p className="font-jet text-[10px] text-[var(--color-accent-blue)] uppercase tracking-wider mb-1">Active</p>
              <p className="font-syne font-bold text-xl">Complete signal review</p>
              <p className="font-dm text-sm text-[var(--color-text-secondary)] mt-2 mb-4">
                Submit a short reflection so the system updates your state.
              </p>
              <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] mb-4">
                <div className="h-full w-[45%] rounded-full bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-blue)]" />
              </div>
              <button
                type="button"
                className="font-dm text-sm px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-hover)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] transition-colors focus-ring"
              >
                Submit Feedback
              </button>
            </div>
            <p className="font-jet text-[10px] uppercase text-[var(--color-text-muted)] mb-2">Upcoming tasks</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {["Outline next milestone", "Prep weekly review"].map((t) => (
                <div
                  key={t}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-3 opacity-75"
                >
                  <p className="font-dm text-sm text-[var(--color-text-secondary)]">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
