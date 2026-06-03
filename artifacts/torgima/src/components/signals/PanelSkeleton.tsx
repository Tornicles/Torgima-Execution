import { LANGUAGE } from "@/lib/language";

export function PanelSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse" role="status" aria-label={LANGUAGE.states.loading}>
      <div className="h-8 bg-gray-100 rounded-lg w-1/3" />
      <div className="h-40 bg-gray-100 rounded-2xl" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );
}
