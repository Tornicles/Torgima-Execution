"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/Button";

export default function LoginMarketingPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-section-sm">
      <div className="w-full max-w-[420px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8 sm:p-10">
        <div className="flex justify-center mb-8">
          <BrandLogo height={36} />
        </div>
        <h1 className="font-syne font-bold text-2xl text-center text-[var(--color-text-primary)]">Welcome back.</h1>
        <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="email" className="font-dm text-sm text-[var(--color-text-secondary)] block mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 font-dm text-sm text-[var(--color-text-primary)] focus-ring outline-none"
              autoComplete="email"
            />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label htmlFor="pw" className="font-dm text-sm text-[var(--color-text-secondary)]">
                Password
              </label>
              <Link href="#" className="font-dm text-xs text-[var(--color-accent-blue)] hover:underline focus-ring rounded-sm">
                Forgot password?
              </Link>
            </div>
            <input
              id="pw"
              type="password"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 font-dm text-sm text-[var(--color-text-primary)] focus-ring outline-none"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" variant="primary" className="w-full justify-center mt-2">
            Sign in →
          </Button>
        </form>
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--color-border)]" />
          </div>
          <span className="relative flex justify-center font-dm text-xs text-[var(--color-text-muted)]">
            <span className="bg-[var(--color-surface-2)] px-3">or</span>
          </span>
        </div>
        <Button type="button" variant="outline" className="w-full justify-center">
          Continue with Google
        </Button>
        <p className="mt-8 text-center font-dm text-sm text-[var(--color-text-muted)]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--color-accent-blue)] hover:underline focus-ring rounded-sm">
            Start Free →
          </Link>
        </p>
      </div>
    </div>
  );
}
