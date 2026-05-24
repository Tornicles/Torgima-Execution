import type { ReactNode } from "react";

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="p-8 space-y-4 animate-pulse max-w-7xl mx-auto">
      <div className="h-10 bg-gray-100 rounded-lg w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-2xl" />
      <p className="text-xs text-gray-400 text-center">{label}</p>
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-8 max-w-lg mx-auto text-center space-y-3">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-sm text-emerald-600 underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function PageEmpty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="p-12 text-center space-y-3 max-w-md mx-auto">
      <p className="font-semibold text-gray-900">{title}</p>
      {description && <p className="text-sm text-gray-500">{description}</p>}
      {action}
    </div>
  );
}
