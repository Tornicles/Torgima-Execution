"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Layers, History, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { fadeUpVariants } from "@/lib/motion";

const benefits = [
  { title: "Always know your next action", body: "No decision fatigue. Torgima tells you what to do, in order, every day.", Icon: CheckCircle2 },
  { title: "Plans that adapt to reality", body: "When you fall behind or push ahead, the system recalibrates automatically.", Icon: Layers },
  { title: "Build real momentum", body: "Execution history shapes your next tasks. The more you do, the smarter it gets.", Icon: TrendingUp },
  { title: "Never lose your place", body: "Your blueprint tracks every phase, project, and task. Nothing falls through.", Icon: History },
  { title: "Accountability built in", body: "Every task requires a completion signal. No marking things done without proof.", Icon: ShieldCheck },
  { title: "Scale when you're ready", body: "Add team members, expand goals, or run multiple projects as you grow.", Icon: Users },
];

export function Benefits() {
  return (
    <section className="py-section-sm lg:py-section px-4 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUpVariants}
          className="mb-14"
        >
          <h2 className="font-syne font-bold text-3xl sm:text-4xl text-[var(--color-text-primary)]">Stop planning. Start finishing.</h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: (i % 3) * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -2 }}
              className="group relative rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] bg-[var(--color-surface-2)] p-5 pl-6 overflow-hidden transition-colors duration-200"
            >
              <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-accent-purple)] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <div className="flex gap-4">
                <b.Icon className="w-5 h-5 text-[var(--color-accent-blue)] shrink-0 mt-0.5" aria-hidden />
                <div>
                  <h3 className="font-syne font-semibold text-[17px] text-[var(--color-text-primary)] mb-1.5">{b.title}</h3>
                  <p className="font-dm text-sm text-[var(--color-text-secondary)] leading-relaxed">{b.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
