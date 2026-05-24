export function ProgressBar({
  value,
  className = "bg-emerald-500",
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
