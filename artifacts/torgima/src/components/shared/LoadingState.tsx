/** DOC 31 — skeleton loading surface for major screens. */
export function LoadingState({
  label = "Loading…",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent"
        aria-hidden
      />
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
    </div>
  );
}
