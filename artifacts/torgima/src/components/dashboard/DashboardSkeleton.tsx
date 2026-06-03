import { LANGUAGE } from "@/lib/language";

/** DOC 33 — never show a blank dashboard while loading. */
export function DashboardSkeleton() {
  return (
    <div
      className="p-4 sm:p-8 space-y-6 animate-pulse max-w-5xl"
      role="status"
      aria-live="polite"
      aria-label={LANGUAGE.states.loading}
    >
      <div className="h-10 bg-gray-100 rounded-lg w-full max-w-72" />
      <div className="h-40 bg-gray-100 rounded-2xl w-full" />
      <div className="h-12 bg-gray-100 rounded-xl w-full max-w-md" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
