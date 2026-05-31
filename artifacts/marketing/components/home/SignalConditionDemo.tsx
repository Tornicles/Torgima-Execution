"use client";

import { useState } from "react";
import { ConditionBadge } from "@workspace/design-system";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { CONDITIONS } from "@/lib/marketing-content";
import { cn } from "@/lib/utils";

export function SignalConditionDemo() {
  const [active, setActive] = useState(0);
  const c = CONDITIONS[active];

  return (
    <section className="section-dark py-20 sm:py-28 border-t border-dark-border">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading
          title="Your execution score changes how the system treats you."
          subtitle="This is not a points game. This is real performance-based execution control."
        />
        <div className="mt-12 flex flex-wrap gap-2">
          {CONDITIONS.map((item, i) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all min-h-[44px]",
                active === i
                  ? "bg-primary text-white"
                  : "bg-dark-card border border-dark-border text-zinc-400 hover:text-white",
              )}
            >
              {item.emoji} {item.label}
            </button>
          ))}
        </div>
        <div className="mt-8 glass-card rounded-2xl p-8 max-w-2xl">
          <ConditionBadge condition={c.key} label={c.label} emoji={c.emoji} className="mb-4" />
          <p className="text-3xl font-syne font-bold text-white">{c.label}</p>
          <p className="mt-4 text-zinc-400 leading-relaxed">{c.desc}</p>
          <p className="mt-6 font-jet text-sm text-primary-bright">{c.tasks}</p>
        </div>
      </div>
    </section>
  );
}
