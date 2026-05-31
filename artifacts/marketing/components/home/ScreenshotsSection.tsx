"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardMockup, type MockVariant } from "@/components/shared/DashboardMockup";
import { SectionHeading } from "@/components/shared/SectionHeading";

const TABS: { id: string; label: string; variant: MockVariant; callouts: { label: string; side: "left" | "right" }[] }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    variant: "dashboard",
    callouts: [
      { label: "Your execution state (Getting Started → Peak Performance)", side: "left" },
      { label: "Today's 8 tasks — specific, goal-aligned, difficulty-matched", side: "right" },
      { label: "Day streak and progress signals", side: "left" },
      { label: "Where you are in your project", side: "right" },
    ],
  },
  {
    id: "validator",
    label: "Idea Validator",
    variant: "validator",
    callouts: [
      { label: "Real competitor names with full profiles", side: "left" },
      { label: "Idea Strength Score — honest, not flattering", side: "right" },
      { label: "Economic environment for your country", side: "left" },
      { label: "3 optimized execution paths", side: "right" },
    ],
  },
  {
    id: "tasks",
    label: "Task View",
    variant: "tasks",
    callouts: [
      { label: "Step-by-step instructions", side: "left" },
      { label: "Definition of done", side: "right" },
      { label: "Why this task matters now", side: "left" },
      { label: "Difficulty matched to your level", side: "right" },
    ],
  },
  {
    id: "signals",
    label: "Progress Signals",
    variant: "signals",
    callouts: [
      { label: "Completion rate & quality score", side: "left" },
      { label: "7 execution states", side: "right" },
      { label: "Momentum streak tracking", side: "left" },
      { label: "Condition controls task count", side: "right" },
    ],
  },
  {
    id: "structure",
    label: "Project Structure",
    variant: "structure",
    callouts: [
      { label: "Stages: Foundation → Scale", side: "left" },
      { label: "Sprints and steps auto-built", side: "right" },
      { label: "Every task traces to your goal", side: "left" },
      { label: "Stage advancement via signals", side: "right" },
    ],
  },
];

export function ScreenshotsSection() {
  const [active, setActive] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <section className="section-dark py-24">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading
          title="See exactly what you're getting."
          subtitle="Real UI. Real structure. No stock photos — this is the execution system."
          className="mx-auto text-center"
        />

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`min-h-[48px] px-4 py-2 rounded-full text-sm font-medium transition-all ${
                active === t.id
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "border border-dark-border text-zinc-400 hover:text-white hover:border-primary-bright/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative mt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="relative"
            >
              <div className="hidden lg:block">
                {tab.callouts.map((c, i) => (
                  <div
                    key={c.label}
                    className={`absolute z-10 max-w-[200px] ${
                      c.side === "left" ? "left-0" : "right-0"
                    }`}
                    style={{ top: `${18 + i * 22}%` }}
                  >
                    <div className="glass-card rounded-lg px-3 py-2 text-xs text-zinc-300 shadow-xl">
                      <span className="text-primary-bright mr-1">→</span>
                      {c.label}
                    </div>
                  </div>
                ))}
              </div>

              <DashboardMockup variant={tab.variant} />

              <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:hidden">
                {tab.callouts.map((c) => (
                  <li key={c.label} className="text-sm text-zinc-400 flex gap-2">
                    <span className="text-primary-bright shrink-0">→</span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
