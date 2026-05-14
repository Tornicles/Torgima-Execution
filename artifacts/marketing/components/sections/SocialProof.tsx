"use client";

import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";
import { DividerDot } from "@/components/ui/Divider";

const quotes = [
  {
    text:
      "I've used every productivity app. Nothing kept me executing consistently until Torgima. It's the first system that actually adapts to what's happening in my life.",
    name: "Marcus T.",
    role: "Founder",
  },
  {
    text: "I had the goal. I had the plan. I just never knew what to do next. Torgima fixed that problem completely.",
    name: "Priya S.",
    role: "Creator & Operator",
  },
  {
    text: "The signal system is what got me. It's not just tracking — it's intelligence. It knows when I'm slipping before I do.",
    name: "Jordan K.",
    role: "Product Builder",
  },
];

export function SocialProof() {
  return (
    <section className="py-section-sm lg:py-section px-4 border-t border-[var(--color-border)] bg-[var(--color-black)]">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUpVariants}
          className="font-syne font-bold text-3xl sm:text-4xl text-center text-[var(--color-text-primary)] mb-14"
        >
          Built for people who are serious about execution.
        </motion.h2>

        <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 mb-12 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {quotes.map((q, i) => (
            <motion.div
              key={q.name}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -2 }}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 min-w-[280px] md:min-w-0 snap-center shrink-0 md:shrink"
            >
              <p className="font-syne text-5xl text-[var(--color-accent-purple)] opacity-30 leading-none mb-3">“</p>
              <p className="font-dm text-[15px] text-[var(--color-text-primary)] italic leading-relaxed mb-6">{q.text}</p>
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] opacity-80" />
                <div>
                  <p className="font-syne font-semibold text-sm">{q.name}</p>
                  <p className="font-dm text-xs text-[var(--color-text-muted)]">{q.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center font-jet text-[13px] text-[var(--color-text-muted)] flex flex-wrap justify-center gap-1"
        >
          <span>1,200+ goals launched</span>
          <DividerDot />
          <span>89% task completion rate</span>
          <DividerDot />
          <span>3x faster goal progress</span>
        </motion.p>
      </div>
    </section>
  );
}
