"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const plans = [
  { id: "starter", label: "Starter (Free)" },
  { id: "growth", label: "Growth" },
  { id: "ultimate", label: "Ultimate" },
] as const;

export default function SignupPage() {
  const [plan, setPlan] = useState<(typeof plans)[number]["id"]>("starter");
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-section-sm">
      <div className="w-full max-w-[420px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8 sm:p-10">
        <div className="flex justify-center mb-8">
          <BrandLogo height={36} />
        </div>
        <h1 className="font-syne font-bold text-2xl text-center text-[var(--color-text-primary)]">Build your execution system.</h1>
        <p className="mt-2 font-dm text-sm text-center text-[var(--color-text-secondary)]">Start with your goal. Let Torgima do the rest.</p>

        <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="name" className="font-dm text-sm text-[var(--color-text-secondary)] block mb-1.5">
              Full name
            </label>
            <input id="name" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 font-dm text-sm focus-ring outline-none" />
          </div>
          <div>
            <label htmlFor="semail" className="font-dm text-sm text-[var(--color-text-secondary)] block mb-1.5">
              Email
            </label>
            <input id="semail" type="email" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 font-dm text-sm focus-ring outline-none" />
          </div>
          <div>
            <label htmlFor="spw" className="font-dm text-sm text-[var(--color-text-secondary)] block mb-1.5">
              Password
            </label>
            <input id="spw" type="password" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 font-dm text-sm focus-ring outline-none" />
          </div>
          <fieldset>
            <legend className="font-dm text-sm text-[var(--color-text-secondary)] mb-2">Plan</legend>
            <div className="space-y-2">
              {plans.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-3 cursor-pointer font-dm text-sm transition-colors",
                    plan === p.id
                      ? "border-[var(--color-accent-purple)] bg-[var(--color-accent-glow)]"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]",
                  )}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p.id}
                    checked={plan === p.id}
                    onChange={() => setPlan(p.id)}
                    className="accent-[var(--color-accent-purple)]"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" variant="primary" className="w-full justify-center">
            Create Account →
          </Button>
        </form>
        <p className="mt-6 text-center font-dm text-sm text-[var(--color-text-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-accent-blue)] hover:underline focus-ring rounded-sm">
            Log in
          </Link>
        </p>
        <p className="mt-4 text-center font-dm text-xs text-[var(--color-text-muted)] leading-relaxed">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline focus-ring rounded-sm">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline focus-ring rounded-sm">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
