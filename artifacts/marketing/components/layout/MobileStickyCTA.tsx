"use client";

import Link from "next/link";
import { VALIDATE_URL } from "@/lib/seo";

export function MobileStickyCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-dark-border bg-[#0f0a1a]/95 backdrop-blur-lg p-3 md:hidden safe-area-pb">
      <Link
        href={VALIDATE_URL}
        className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary font-semibold text-white shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
      >
        Validate My Idea Free →
      </Link>
    </div>
  );
}
