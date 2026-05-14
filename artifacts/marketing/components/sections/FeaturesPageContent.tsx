"use client";

import { motion } from "framer-motion";
import { fadeUpVariants } from "@/lib/motion";
import { marketingFeatures } from "@/lib/marketing-features";

export function FeaturesPageContent() {
  return (
    <div className="py-section-sm lg:py-section px-4 max-w-6xl mx-auto">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUpVariants}
        className="max-w-3xl mb-20"
      >
        <h1 className="font-syne font-extrabold text-4xl sm:text-5xl lg:text-6xl text-[var(--color-text-primary)]">
          Everything your goal needs to become reality.
        </h1>
        <p className="mt-6 font-dm text-lg text-[var(--color-text-secondary)]">
          Torgima is not a feature — it&apos;s a system. Every layer connects.
        </p>
      </motion.div>

      <div className="space-y-24 lg:space-y-32">
        {marketingFeatures.map((f, i) => (
          <motion.section
            key={f.id}
            id={f.id}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center"
          >
            <div className={i % 2 === 1 ? "lg:order-2" : ""}>
              <p className="font-jet text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent-blue)] mb-3">{`0${i + 1}`}</p>
              <h2 className="font-syne font-bold text-2xl sm:text-3xl text-[var(--color-text-primary)] mb-4">{f.title}</h2>
              <p className="font-dm text-[var(--color-text-secondary)] leading-relaxed text-[15px]">{f.description}</p>
            </div>
            <div
              className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 lg:p-8 ${
                i % 2 === 1 ? "lg:order-1" : ""
              }`}
            >
              <div className="max-w-[260px] mx-auto">{f.svg}</div>
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
