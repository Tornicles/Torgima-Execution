import { getConditionStyle } from "../condition-styles";
import { cn } from "../utils";

export function ConditionBadge({
  condition,
  label,
  emoji,
  className,
}: {
  condition?: string;
  label: string;
  emoji?: string;
  className?: string;
}) {
  const style = getConditionStyle(condition);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-3 py-1.5 rounded-full",
        "font-body text-sm font-semibold",
        style.bg,
        style.border,
        style.text,
        className,
      )}
    >
      <span className={cn("w-2 h-2 rounded-full shrink-0", style.dot)} />
      {emoji ? <span>{emoji}</span> : null}
      {label}
    </span>
  );
}
