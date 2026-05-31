"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";

const problems = [
  "You have 47 tasks and no idea which one actually matters today",
  "You make a plan on Sunday. By Tuesday you've abandoned it",
  "You finish the day busy but wonder if you actually moved forward",
];

export function ProblemSection() {
  return (
    <section className="section-light py-20 sm:py-28">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading
          light
          title="Every other tool lets you organize your work. None of them make you execute it."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {problems.map((text, i) => (
            <motion.div
              key={text}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <p className="text-4xl font-syne font-bold text-primary/30 mb-4">{i + 1}</p>
              <p className="text-zinc-700 leading-relaxed font-medium">{text}</p>
            </motion.div>
          ))}
        </div>
        <p className="mt-10 text-center text-lg text-zinc-600 max-w-2xl mx-auto">
          Sound familiar? This is what happens when you use a tool built for organizing instead of
          one built for executing.
        </p>
      </div>
    </section>
  );
}
