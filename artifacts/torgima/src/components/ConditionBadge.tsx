import React from "react";
import { Badge } from "@/components/ui/badge";
import { SignalStateCondition } from "@workspace/api-client-react";

interface ConditionBadgeProps {
  condition?: SignalStateCondition | string | null;
  className?: string;
}

export function ConditionBadge({ condition, className = "" }: ConditionBadgeProps) {
  if (!condition) return <Badge variant="outline" className={`font-mono ${className}`}>UNKNOWN</Badge>;

  const variants: Record<string, { bg: string, text: string, border: string }> = {
    optimal: { bg: "bg-primary/20", text: "text-primary", border: "border-primary/30" },
    building: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
    recovering: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
    critical: { bg: "bg-destructive/20", text: "text-destructive", border: "border-destructive/30" },
    blocked: { bg: "bg-red-900/40", text: "text-red-400", border: "border-red-900/50" },
  };

  const style = variants[condition] || { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };

  return (
    <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${style.bg} ${style.text} ${style.border} ${className}`}>
      {condition}
    </div>
  );
}