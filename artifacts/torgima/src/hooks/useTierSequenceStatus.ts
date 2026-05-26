import { useEffect, useState } from "react";
import { apiGet } from "@/lib/torgima-api";
import type { FeatureStatusPayload } from "@/lib/feature-gate";

export function useTierSequenceStatus(blueprintId?: string) {
  const [data, setData] = useState<FeatureStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = blueprintId ? `?blueprintId=${encodeURIComponent(blueprintId)}` : "";
    void apiGet<FeatureStatusPayload>(`/api/v1/features/status${qs}`)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load sequence status");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [blueprintId]);

  return { data, loading, error };
}
