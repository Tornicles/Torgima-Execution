import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-jet text-[11px] uppercase tracking-[0.12em] px-3.5 py-1 rounded-full border",
        "text-[var(--color-accent-blue)] bg-[var(--color-accent-subtle)] border-[rgba(79,140,255,0.2)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
