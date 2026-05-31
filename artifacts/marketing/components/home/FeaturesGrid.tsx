"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { HOME_FEATURES } from "@/lib/marketing-content";

export function FeaturesGrid() {
  return (
    <section className="section-light py-20 sm:py-28">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading
          light
          title="Everything you need to execute. Nothing you don't."
          subtitle="Replace 6 tools with one intelligent system."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 4) * 0.05 }}
              className="rounded-2xl border border-zinc-200 bg-white p-6 hover:border-primary/30 hover:shadow-lg transition-all"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="mt-4 font-syne font-bold text-[#18181b]">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
            </motion.article>
          ))}
        </div>
        <p className="mt-10 text-center">
          <Link href="/features" className="text-primary font-semibold hover:underline">
            Explore all features →
          </Link>
        </p>
      </div>
    </section>
  );
}
