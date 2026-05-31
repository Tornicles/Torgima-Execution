"use client";

import { motion } from "framer-motion";
import { Play, Star } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { DashboardMockup } from "@/components/shared/DashboardMockup";
import { VALIDATE_URL } from "@/lib/seo";

const lines = ["Stop Guessing.", "Start Executing.", "Every. Single. Day."];

export function Hero() {
  return (
    <section className="relative min-h-[90vh] mesh-bg hero-grid-bg overflow-hidden">
      <div className="mx-auto max-w-content px-4 sm:px-6 pt-16 pb-24 lg:pt-24">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="mb-6">The Execution Operating System</Badge>
          <h1 className="font-syne text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]">
            {lines.map((line, i) => (
              <motion.span
                key={line}
                className="block text-gradient"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                {line}
              </motion.span>
            ))}
          </h1>
          <motion.p
            className="mt-6 text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            Torgima is not a to-do list. It&apos;s not a project manager. It&apos;s an intelligent
            execution system that analyzes your idea, validates it against real market data, builds
            your complete project plan, and tells you the exact 8 tasks to do every single day —
            adapting based on how you actually perform.
          </motion.p>
          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            <Button href={VALIDATE_URL} variant="primary" className="w-full sm:w-auto text-base px-8">
              Validate My Idea Free →
            </Button>
            <Button href="/how-it-works" variant="ghost" className="w-full sm:w-auto">
              <Play className="h-4 w-4" />
              Watch How It Works
            </Button>
          </motion.div>
          <motion.div
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-zinc-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            <span className="flex items-center gap-1 text-amber-400">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </span>
            <span>Trusted by 2,400+ creators, founders, and solopreneurs</span>
          </motion.div>
        </div>
        <motion.div
          className="mt-16 lg:mt-20"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
        >
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}
