import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils";

type Variant = "primary" | "ghost" | "secondary";

export function PrimaryButton({
  children,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-8 py-4",
        "bg-gradient-to-r from-primary to-primary-bright",
        "font-heading text-base font-bold tracking-wide text-white",
        "transition-all duration-150",
        "hover:-translate-y-0.5 hover:scale-105 hover:shadow-glow",
        "active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-bright",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-8 py-4",
        "border border-primary/40 bg-primary-bright/5",
        "font-heading text-base font-semibold text-primary-bright",
        "transition-all duration-150",
        "hover:border-primary-bright hover:bg-primary-bright/10 hover:shadow-glow",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TorgimaButton({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  if (variant === "ghost") {
    return (
      <GhostButton className={className} {...props}>
        {children}
      </GhostButton>
    );
  }
  if (variant === "secondary") {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-3",
          "bg-dark-card border border-dark-border text-text-primary font-heading font-semibold",
          "hover:border-primary/30 hover:shadow-glow transition-all duration-150",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <PrimaryButton className={className} {...props}>
      {children}
    </PrimaryButton>
  );
}
