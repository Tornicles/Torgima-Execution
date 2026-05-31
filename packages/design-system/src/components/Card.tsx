import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils";

export function TorgimaCard({
  children,
  glowing = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  glowing?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dark-border bg-dark-card p-6",
        "transition-all duration-[250ms]",
        "hover:border-primary/30",
        glowing ? "shadow-glow" : "shadow-card hover:shadow-card-hover",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
