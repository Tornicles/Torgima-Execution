import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "purple",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "purple" | "green" | "amber" | "neutral";
}) {
  const tones = {
    purple: "bg-primary/20 text-primary-bright border-primary-bright/30",
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    neutral: "bg-white/10 text-zinc-300 border-white/15",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
