"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { fadeUpVariants } from "@/lib/motion";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Plan = "annual" | "monthly";

const faqs = [
  {
    q: 'What is a "blueprint"?',
    a: "Your blueprint is the execution map from goal to daily tasks — phases, projects, and ordered work. It is the structure the system uses to decide what you do next.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. You can upgrade or downgrade when your execution needs change.",
  },
  {
    q: "Is my data safe?",
    a: "We use industry-standard encryption in transit and restrict access to operational data. Details are in our privacy policy.",
  },
  {
    q: "What happens if I miss days?",
    a: "The recovery system detects stalls, reduces load, and issues recovery tasks so you return without losing traceability.",
  },
  {
    q: "What is Team Mode?",
    a: "Team Mode is an add-on for coordinating execution across multiple contributors on Ultimate. Contact us when you are ready to enable it.",
  },
];

function PricingCard({
  title,
  badge,
  badgeVariant,
  price,
  period,
  sub,
  cta,
  featured,
  lines,
}: {
  title: string;
  badge: string;
  badgeVariant?: "muted";
  price: string;
  period: string;
  sub: string;
  cta: string;
  featured?: boolean;
  lines: string[];
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        "rounded-[var(--radius-lg)] border bg-[var(--color-surface-2)] p-6 sm:p-8 flex flex-col h-full",
        featured
          ? "border-[var(--color-accent-purple)] shadow-[0_0_40px_rgba(124,92,252,0.12)]"
          : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]",
      )}
    >
      <div className="mb-2">
        {badgeVariant === "muted" ? (
          <span className="font-jet text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{badge}</span>
        ) : (
          <Badge className={featured ? "border-[var(--color-accent-purple)]/40" : ""}>{badge}</Badge>
        )}
      </div>
      <h3 className="font-syne font-bold text-xl text-[var(--color-text-primary)]">{title}</h3>
      <p className="mt-3 font-syne font-extrabold text-4xl text-[var(--color-text-primary)]">
        {price}
        <span className="font-dm font-normal text-base text-[var(--color-text-muted)]"> {period}</span>
      </p>
      <p className="mt-2 font-dm text-sm text-[var(--color-text-secondary)]">{sub}</p>
      <Link
        href="/signup"
        className={cn(
          "mt-8 inline-flex justify-center items-center rounded-[var(--radius-sm)] px-5 py-3 font-dm font-medium text-center transition-all focus-ring",
          featured
            ? "bg-[var(--color-accent-purple)] text-white hover:shadow-[0_0_20px_rgba(124,92,252,0.4)]"
            : "border border-[var(--color-border-hover)] text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]",
        )}
      >
        {cta}
      </Link>
      <ul className="mt-8 space-y-2.5 flex-1 font-dm text-sm text-[var(--color-text-secondary)]">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="text-[var(--color-accent-blue)] shrink-0">✓</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function PricingPageContent() {
  const [plan, setPlan] = useState<Plan>("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const growthPrice = plan === "annual" ? "$15" : "$19";
  const ultimatePrice = plan === "annual" ? "$39" : "$49";
  const period = plan === "annual" ? "/ month, billed annually" : "/ month";

  return (
    <div className="py-section-sm lg:py-section px-4 max-w-6xl mx-auto">
      <motion.div initial="hidden" animate="visible" variants={fadeUpVariants} className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="font-syne font-extrabold text-4xl sm:text-5xl text-[var(--color-text-primary)]">Simple, honest pricing.</h1>
        <p className="mt-4 font-dm text-lg text-[var(--color-text-secondary)]">Start free. Upgrade when you&apos;re ready to go deeper.</p>
        <div className="mt-8 inline-flex rounded-full border border-[var(--color-border)] p-1 bg-[var(--color-surface-2)]">
          <button
            type="button"
            onClick={() => setPlan("annual")}
            className={cn(
              "relative px-5 py-2 rounded-full font-dm text-sm font-medium transition-colors focus-ring",
              plan === "annual" ? "text-white bg-[var(--color-accent-purple)]/30" : "text-[var(--color-text-muted)]",
            )}
          >
            Annual
            {plan === "annual" ? (
              <span className="ml-2 font-jet text-[10px] uppercase text-[var(--color-accent-blue)]">Save 20%</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setPlan("monthly")}
            className={cn(
              "px-5 py-2 rounded-full font-dm text-sm font-medium transition-colors focus-ring",
              plan === "monthly" ? "text-white bg-[var(--color-surface-3)]" : "text-[var(--color-text-muted)]",
            )}
          >
            Monthly
          </button>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-5 items-stretch">
        <PricingCard
          title="Starter"
          badge="FREE FOREVER"
          badgeVariant="muted"
          price="$0"
          period="/ month"
          sub="For individuals starting their first goal"
          cta="Start Free →"
          lines={[
            "1 active goal",
            "Basic blueprint (plans, phases, tasks)",
            "AI-generated daily tasks",
            "Simple feedback loop",
            "Basic progress tracking",
            "Simplified signal states",
            "Community access (coming soon)",
          ]}
        />
        <PricingCard
          featured
          title="Growth"
          badge="MOST POPULAR"
          price={growthPrice}
          period={period}
          sub="For serious individuals ready to execute at full depth"
          cta="Start Growth →"
          lines={[
            "Multiple active goals",
            "Full blueprint depth (all layers)",
            "Full signal system (7 states)",
            "Condition-controlled task engine",
            "Feedback interrogation + anti-gaming",
            "Recovery and adaptation system",
            "Knowledge injection per task",
            "Academy tasks",
            "Strategy pivot engine",
            "Capability tracking",
            "Behavior pattern detection",
            "Full execution history",
          ]}
        />
        <PricingCard
          title="Ultimate"
          badge="FULL POWER"
          badgeVariant="muted"
          price={ultimatePrice}
          period={period}
          sub="For operators and builders who run goals at full intelligence"
          cta="Start Ultimate →"
          lines={[
            "Everything in Growth",
            "Predictive signals + burnout warning",
            "Advanced capability modeling",
            "Risk-based execution limits",
            "Full strategy simulation",
            "Adaptive phase control",
            "Team mode add-on available",
            "Priority support",
            "Full audit trail",
          ]}
        />
      </div>

      <div className="mt-24 max-w-2xl mx-auto">
        <h2 className="font-syne font-bold text-2xl text-center mb-10">Questions</h2>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={f.q} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
              <button
                type="button"
                aria-expanded={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-dm text-[var(--color-text-primary)] focus-ring"
              >
                <span>{f.q}</span>
                <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", openFaq === i && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === i ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-4 font-dm text-sm text-[var(--color-text-secondary)] leading-relaxed border-t border-[var(--color-border)] pt-3">
                      {f.a}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
