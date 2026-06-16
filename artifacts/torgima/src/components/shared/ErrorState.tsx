import { LANGUAGE } from "@/lib/language";

/** DOC 31 — error display with retry for major screens. */
export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm text-[#64748B]">{message ?? LANGUAGE.errors.serverBusy}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-semibold text-[#5B21FF] underline"
        >
          {LANGUAGE.actions.retry}
        </button>
      ) : null}
    </div>
  );
}
