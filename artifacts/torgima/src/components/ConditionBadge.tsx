import { ConditionBadge as DSConditionBadge } from "@workspace/design-system";
import { getConditionLabel } from "@/lib/language";

export function ConditionBadge({
  condition,
  className,
}: {
  condition: string;
  className?: string;
}) {
  const key = condition.toLowerCase().replace(/-/g, "_");
  const display = getConditionLabel(key);
  return (
    <DSConditionBadge
      condition={key}
      label={display.label}
      emoji={display.emoji}
      className={className}
    />
  );
}
