"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fadeUpVariants } from "@/lib/motion";

export function FinalCTA() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center py-section-sm lg:py-section px-4 border-t border-[var(--color-border)] bg-[var(--color-black)] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_600px_400px_at_50%_50%,rgba(124,92,252,0.12)_0%,transparent_65%)]"
        aria-hidden
      />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUpVariants}
        className="relative z-10 max-w-[700px] mx-auto text-center"
      >
        <p className="font-jet text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent-blue)] mb-6">
          Start your execution system
        </p>
        <h2 className="font-syne font-extrabold text-[40px] sm:text-[64px] leading-[1.08] text-[var(--color-text-primary)]">
          Your goal deserves
          <br />
          more than a list.
        </h2>
        <p className="mt-6 font-dm text-lg text-[var(--color-text-secondary)] max-w-md mx-auto">
          Give it a system. Give it intelligence. Give it Torgima.
        </p>
        <Link
          href="/signup"
          className="group mt-10 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent-purple)] px-8 py-3.5 font-syne font-semibold text-lg text-white hover:shadow-[0_0_24px_rgba(124,92,252,0.45)] transition-shadow duration-200 focus-ring"
        >
          Create Your System
          <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <p className="mt-6 font-dm text-xs text-[var(--color-text-muted)]">Free to start. No credit card required.</p>
      </motion.div>
    </section>
  );
}
