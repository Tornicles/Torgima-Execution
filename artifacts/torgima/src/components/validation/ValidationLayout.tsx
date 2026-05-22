import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { API_BASE_URL } from "@/lib/api-base";
import { apiGet } from "@/lib/torgima-api";

type ActiveDraft = {
  blueprintId: string;
  status: string;
  validationId?: string | null;
  erectorValidationId?: string | null;
};

/**
 * Prompt 6 — validation route group guard (Vite/wouter equivalent of app/(validation)/layout.tsx).
 * Requires an in-progress blueprint draft before rendering validation screens.
 */
export function ValidationLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!API_BASE_URL) {
      setLocation("/onboarding/goal");
      return;
    }
    void apiGet<ActiveDraft | null>("/api/v1/validation/active-draft")
      .then((draft) => {
        if (!draft?.blueprintId) {
          setLocation("/onboarding/goal");
          return;
        }
        setReady(true);
      })
      .catch(() => setLocation("/onboarding/goal"));
  }, [setLocation]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Checking validation draft…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
