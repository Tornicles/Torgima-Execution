"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { VALIDATE_URL, SIGNUP_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

const USE_CASES = [
  { href: "/use-cases/creators", label: "For Creators" },
  { href: "/use-cases/solopreneurs", label: "For Solopreneurs" },
  { href: "/use-cases/agencies", label: "For Agency Owners" },
  { href: "/use-cases/coaches", label: "For Coaches" },
  { href: "/use-cases/startups", label: "For Startups" },
];

const COMPARE = [
  { href: "/compare/torgima-vs-notion", label: "vs Notion" },
  { href: "/compare/torgima-vs-clickup", label: "vs ClickUp" },
  { href: "/compare/torgima-vs-asana", label: "vs Asana" },
  { href: "/compare/torgima-vs-todoist", label: "vs Todoist" },
];

function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-zinc-300 hover:text-white transition-colors py-2"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] rounded-xl border border-dark-border bg-dark-card py-2 shadow-xl z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/5"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-dark/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 sm:px-6 h-16">
        <Link href="/" className="font-syne font-extrabold text-lg tracking-tight text-white">
          TORGIMA
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          <Link href="/features" className="text-sm text-zinc-300 hover:text-white">
            Features
          </Link>
          <Link href="/how-it-works" className="text-sm text-zinc-300 hover:text-white">
            How It Works
          </Link>
          <NavDropdown label="Use Cases" items={USE_CASES} />
          <Link href="/pricing" className="text-sm text-zinc-300 hover:text-white">
            Pricing
          </Link>
          <Link href="/blog" className="text-sm text-zinc-300 hover:text-white">
            Blog
          </Link>
          <NavDropdown label="Compare" items={COMPARE} />
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Button href={`${SIGNUP_URL}?mode=login`} variant="ghost" className="min-h-[40px] px-4 py-2 text-sm">
            Sign In
          </Button>
          <Button href={VALIDATE_URL} variant="primary" className="min-h-[40px] px-4 py-2 text-sm">
            Start Free →
          </Button>
        </div>

        <button
          type="button"
          className="lg:hidden p-2 text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden border-t border-dark-border bg-dark-card px-4 py-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <Link href="/features" className="block text-white" onClick={() => setMobileOpen(false)}>
            Features
          </Link>
          <Link href="/how-it-works" className="block text-white" onClick={() => setMobileOpen(false)}>
            How It Works
          </Link>
          <p className="text-xs uppercase text-zinc-500 font-bold">Use Cases</p>
          {USE_CASES.map((l) => (
            <Link key={l.href} href={l.href} className="block text-zinc-300 pl-2" onClick={() => setMobileOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link href="/pricing" className="block text-white" onClick={() => setMobileOpen(false)}>
            Pricing
          </Link>
          <Link href="/blog" className="block text-white" onClick={() => setMobileOpen(false)}>
            Blog
          </Link>
          <p className="text-xs uppercase text-zinc-500 font-bold">Compare</p>
          {COMPARE.map((l) => (
            <Link key={l.href} href={l.href} className="block text-zinc-300 pl-2" onClick={() => setMobileOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="pt-4 flex flex-col gap-3">
            <Button href={`${SIGNUP_URL}?mode=login`} variant="ghost" className="w-full">
              Sign In
            </Button>
            <Button href={VALIDATE_URL} variant="primary" className="w-full">
              Start Free →
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
