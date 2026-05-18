import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONDITION_COLORS, CONDITION_LABELS } from "@/lib/execution-language";
import { ConditionExplanation } from "@/components/bhudhi/ConditionExplanation";

interface ConditionBadgeProps {
  condition?: string | null;
  className?: string;
  showExplanation?: boolean;
  explanation?: string | null;
}

function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "_");
}

export function ConditionBadge({
  condition,
  className = "",
  showExplanation = false,
  explanation,
}: ConditionBadgeProps) {
  if (!condition) {
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase border border-gray-200 text-gray-500 ${className}`}>
        Unknown
      </span>
    );
  }

  const key = normalizeKey(condition);
  const label = CONDITION_LABELS[key] ?? condition;
  const colors = CONDITION_COLORS[key] ?? CONDITION_COLORS.stability;

  const badge = (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ring-1 ${colors.bg} ${colors.text} ${colors.ring} ${className}`}
    >
      {label}
    </span>
  );

  if (!showExplanation) return badge;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex">{badge}</button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border-0 shadow-lg" align="start">
        {explanation ? (
          <ConditionExplanation explanation={explanation} condition={key} />
        ) : (
          <p className="p-4 text-sm text-gray-600">Condition intelligence loading…</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
