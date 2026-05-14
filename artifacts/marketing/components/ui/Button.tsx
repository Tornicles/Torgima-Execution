"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "outline" | "large";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent-purple)] text-white font-dm font-medium px-5 py-2.5 rounded-[var(--radius-sm)] hover:shadow-[0_0_20px_rgba(124,92,252,0.4)] transition-[transform,shadow] duration-200 hover:scale-[1.02] active:scale-[0.99]",
  ghost:
    "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-dm font-medium px-2 py-2 transition-colors",
  outline:
    "border border-[var(--color-border-hover)] text-[var(--color-text-primary)] font-dm font-medium px-5 py-3 rounded-[var(--radius-sm)] hover:border-[var(--color-text-muted)] bg-transparent hover:scale-[1.02] active:scale-[0.99] transition-transform",
  large:
    "bg-[var(--color-accent-purple)] text-white font-syne font-semibold text-lg px-8 py-3.5 rounded-[var(--radius-sm)] hover:shadow-[0_0_24px_rgba(124,92,252,0.45)] transition-[transform,shadow] duration-200 hover:scale-[1.02] active:scale-[0.99]",
};

export function Button({
  className,
  variant = "primary",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button type={type} className={cn(variants[variant], "focus-ring outline-none", className)} {...props}>
      {children}
    </button>
  );
}
