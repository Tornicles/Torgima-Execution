import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { DividerDot } from "@/components/ui/Divider";
import { Twitter, Linkedin } from "lucide-react";

const cols = [
  {
    title: "Product",
    links: [
      ["Features", "/features"],
      ["How It Works", "/how-it-works"],
      ["Pricing", "/pricing"],
      ["Changelog", "/blog"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Blog", "/blog"],
      ["Academy", "/features#academy"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Contact", "mailto:support@torgima.com"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-black)] pt-16 pb-10 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
        <div className="lg:col-span-1 space-y-3">
          <BrandLogo height={28} />
          <p className="font-dm text-[13px] text-[var(--color-text-muted)] max-w-xs">
            Execute with intelligence.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="font-jet text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
              {c.title}
            </p>
            <ul className="space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="font-dm text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-ring rounded-sm"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-6xl mt-14 flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-[var(--color-border)]">
        <p className="font-jet text-[11px] text-[var(--color-text-muted)] text-center sm:text-left">
          © 2026 Torgima.
          <DividerDot />
          All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://twitter.com/torgima"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-ring rounded-sm p-1"
            aria-label="Torgima on X"
          >
            <Twitter className="h-5 w-5" />
          </a>
          <a
            href="https://linkedin.com/company/torgima"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-ring rounded-sm p-1"
            aria-label="Torgima on LinkedIn"
          >
            <Linkedin className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
