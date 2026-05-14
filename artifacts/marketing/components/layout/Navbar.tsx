"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

const linkClass =
  "font-dm font-medium text-[13px] tracking-[0.03em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-200 focus-ring rounded-sm px-1 py-1";

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 border-b border-[var(--color-border)] bg-[rgba(5,5,7,0.85)] backdrop-blur-[20px]"
      role="navigation"
      aria-label="Main"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="md:hidden">
            <BrandMark size={32} />
          </span>
          <span className="hidden md:block">
            <BrandLogo height={32} />
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-10" aria-label="Primary">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-5">
          <Link href="/login" className={cn(linkClass, "font-medium")}>
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent-purple)] px-5 py-2.5",
              "font-dm font-medium text-white text-[13px]",
              "shadow-none hover:shadow-[0_0_20px_rgba(124,92,252,0.4)] transition-shadow duration-200",
              "focus-ring",
            )}
          >
            Start Free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden p-2 text-[var(--color-text-primary)] focus-ring rounded-md"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden fixed inset-0 top-16 z-40 flex flex-col gap-1 bg-[var(--color-black)] px-6 py-8 border-t border-[var(--color-border)]"
          >
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-lg font-dm py-3 text-[var(--color-text-primary)]" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link href="/login" className="text-lg font-dm py-3 text-[var(--color-text-secondary)]" onClick={() => setOpen(false)}>
              Log in
            </Link>
            <Link
              href="/signup"
              className="mt-4 inline-flex justify-center items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent-purple)] py-3 font-dm font-medium text-white"
              onClick={() => setOpen(false)}
            >
              Start Free <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
