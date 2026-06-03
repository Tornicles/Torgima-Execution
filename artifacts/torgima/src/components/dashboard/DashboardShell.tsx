import type { ReactNode } from "react";
import { shouldReduceMotion } from "@/lib/dashboard-control";

export function DashboardShell({
  children,
  condition,
}: {
  children: ReactNode;
  condition: string;
}) {
  const reduceMotion = shouldReduceMotion(condition);
  return (
    <div
      className={`dashboard-shell ${reduceMotion ? "dashboard-shell--reduce-motion" : ""}`}
      data-condition={condition}
    >
      {children}
      {reduceMotion ? (
        <style>{`
          .dashboard-shell--reduce-motion * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        `}</style>
      ) : null}
    </div>
  );
}
