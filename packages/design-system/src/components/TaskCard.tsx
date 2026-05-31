import { DIFFICULTY_COLORS } from "../condition-styles";
import { cn } from "../utils";

export type TaskCardData = {
  title: string;
  instruction?: string;
  whyItMatters?: string;
  difficulty?: string;
  difficultyLabel?: string;
  timeEstimateMinutes?: number;
};

export function TaskCard({
  task,
  index,
  onStart,
  className,
}: {
  task: TaskCardData;
  index: number;
  onStart?: () => void;
  className?: string;
}) {
  const diffKey = (task.difficulty ?? "medium").toLowerCase();
  const diffClass = DIFFICULTY_COLORS[diffKey] ?? DIFFICULTY_COLORS.medium;

  return (
    <div
      className={cn(
        "group rounded-xl border border-dark-border bg-dark-card p-5",
        "transition-all duration-[250ms] hover:border-primary/30 hover:shadow-glow",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              "border border-primary/30 bg-primary/20",
              "font-mono text-xs font-bold text-primary-bright",
            )}
          >
            {String(index).padStart(2, "0")}
          </span>
          {task.difficultyLabel ? (
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", diffClass)}>
              {task.difficultyLabel}
            </span>
          ) : null}
        </div>
        {task.timeEstimateMinutes != null ? (
          <span className="text-text-muted text-xs font-mono">~{task.timeEstimateMinutes} min</span>
        ) : null}
      </div>

      <h3 className="font-heading font-bold text-base text-text-primary mb-2 leading-snug group-hover:text-primary-bright transition-colors">
        {task.title}
      </h3>

      {task.instruction ? (
        <p className="text-text-secondary text-sm leading-relaxed mb-4 line-clamp-2">{task.instruction}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {task.whyItMatters ? (
          <span className="text-xs text-text-muted line-clamp-1">{task.whyItMatters}</span>
        ) : (
          <span />
        )}
        {onStart ? (
          <button
            type="button"
            onClick={onStart}
            className="text-primary-bright text-sm font-semibold hover:text-white transition-colors flex items-center gap-1 shrink-0"
          >
            Start <span>→</span>
          </button>
        ) : (
          <span className="text-primary-bright text-sm font-semibold flex items-center gap-1 shrink-0">
            Start <span>→</span>
          </span>
        )}
      </div>
    </div>
  );
}
