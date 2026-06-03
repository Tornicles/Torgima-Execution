import { LANGUAGE } from "@/lib/language";

export function TaskSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl p-6 space-y-4 animate-pulse"
      role="status"
      aria-live="polite"
      aria-label={LANGUAGE.states.loading}
    >
      <div className="h-8 bg-gray-100 rounded-lg w-2/3" />
      <div className="h-32 bg-gray-100 rounded-2xl" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
    </div>
  );
}
