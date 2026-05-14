"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DividerDot } from "@/components/ui/Divider";

const line1 = "Turn your goals";
const line2 = "into daily action.";

function ProofDots() {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] opacity-50"
        />
      ))}
    </div>
  );
}

function HeroMockup() {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="relative mx-auto w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 sm:p-5 shadow-[0_0_80px_rgba(124,92,252,0.12)]"
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3 mb-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <span className="font-jet text-[11px] text-[var(--color-text-muted)]">Torgima · Today&apos;s Execution</span>
      </div>
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
          <p className="font-jet text-[10px] uppercase tracking-[0.14em] text-[var(--color-accent-blue)] mb-2">Active task</p>
          <p className="font-syne font-bold text-lg text-[var(--color-text-primary)] mb-1">Ship onboarding v2</p>
          <p className="font-dm text-sm text-[var(--color-text-secondary)] mb-3">Why: Unblocks the next phase of your blueprint.</p>
          <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden mb-3">
            <div
              className="h-full w-[60%] rounded-full bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-blue)]"
            />
          </div>
          <span className="inline-block font-jet text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            In Progress
          </span>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-1)]/60 p-3 opacity-55">
            <p className="font-dm text-sm text-[var(--color-text-muted)]">Upcoming task {i}</p>
          </div>
        ))}
        <div className="flex items-center justify-between font-jet text-[11px] text-[var(--color-text-secondary)] pt-1">
          <span>Momentum: Rising ↑</span>
          <svg width="64" height="20" viewBox="0 0 64 20" className="text-[var(--color-accent-purple)]" aria-hidden>
            <path d="M0 16 L8 12 L16 14 L24 6 L32 10 L40 4 L48 8 L56 2 L64 4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center pt-28 sm:pt-[120px] pb-section-sm sm:pb-section px-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_800px_500px_at_50%_40%,rgba(124,92,252,0.08)_0%,transparent_70%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 hero-grid-bg opacity-90" aria-hidden />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto"
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } } }}>
          <Badge>AI Execution System · Now Available</Badge>
        </motion.div>

        <motion.h1 className="font-syne font-extrabold text-[40px] leading-[1.05] sm:text-[52px] lg:text-[80px] mt-8 text-[var(--color-text-primary)]">
          <motion.span className="block" variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }}>
            {line1}
          </motion.span>
          <motion.span className="block bg-gradient-to-br from-[#7c5cfc] to-[#4f8cff] bg-clip-text text-transparent" variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 } } }}>
            {line2}
          </motion.span>
        </motion.h1>

        <motion.p
          variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.25 } } }}
          className="mt-6 font-dm text-lg leading-7 text-[var(--color-text-secondary)] max-w-[520px]"
        >
          Torgima builds your personal execution system, generates your daily tasks, and adapts when reality changes.
        </motion.p>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.35 } } }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent-purple)] px-5 py-2.5 font-dm font-medium text-white hover:shadow-[0_0_20px_rgba(124,92,252,0.4)] transition-shadow duration-200 focus-ring"
          >
            Start Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/how-it-works"
            className="group font-dm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] inline-flex items-center gap-1 underline-offset-4 hover:underline transition-colors focus-ring rounded-sm"
          >
            See How It Works
            <ArrowDown className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.45 } } }}
          className="mt-10 flex flex-wrap items-center justify-center gap-2 font-dm text-[13px] text-[var(--color-text-muted)]"
        >
          <span>Trusted by founders, operators, and builders</span>
          <DividerDot />
          <ProofDots />
          <span className="ml-1">1,200+ active goals in execution</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="mt-14 w-full flex justify-center px-2"
        >
          <HeroMockup />
        </motion.div>
      </motion.div>
    </section>
  );
}
