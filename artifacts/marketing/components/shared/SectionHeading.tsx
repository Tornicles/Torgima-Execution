import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  light,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "text-xs font-bold uppercase tracking-[0.2em] mb-4",
            light ? "text-primary" : "text-primary-bright",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "font-syne text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]",
          light ? "text-[#18181b]" : "text-white",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mt-4 text-base sm:text-lg leading-relaxed",
            light ? "text-zinc-600" : "text-[var(--text-secondary)]",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
