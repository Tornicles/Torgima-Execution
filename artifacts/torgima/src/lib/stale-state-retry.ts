import {
  ApiError,
  getDashboardState,
  getGetDashboardStateQueryKey,
  type DashboardState,
} from "@workspace/api-client-react";
import type { QueryClient } from "@tanstack/react-query";

export function isStaleStateConflict(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const data = err.data as {
    ok?: boolean;
    error?: { code?: string; message?: string };
    code?: string;
  } | null;
  const code = data?.error?.code ?? data?.code;
  if (code === "STALE_STATE") return true;
  if (typeof data?.error?.message === "string" && /STALE_STATE/i.test(data.error.message)) return true;
  return /STALE_STATE|stale state|State changed/i.test(err.message);
}
/**
 * Refetches dashboard, then re-runs the mutation with the latest `stateVersion`.
 * Use for endpoints that honor `x-expected-state-version`.
 */
export async function withDashboardStaleRetry<T>(
  queryClient: QueryClient,
  run: (stateVersion: number) => Promise<T>,
): Promise<T> {
  const key = getGetDashboardStateQueryKey();

  const loadDashboard = async (): Promise<DashboardState> => {
    const cached = queryClient.getQueryData<DashboardState>(key);
    if (cached != null) return cached;
    const data = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: ({ signal }) => getDashboardState({ signal }),
    });
    if (data == null) throw new Error("dashboard state unavailable");
    return data;
  };

  let dash = await loadDashboard();

  const attempt = async (version: number) => run(version);

  try {
    return await attempt(dash.stateVersion ?? 0);
  } catch (e) {
    if (!isStaleStateConflict(e)) throw e;
    const refreshed = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: ({ signal }) => getDashboardState({ signal }),
      staleTime: 0,
    });
    if (refreshed == null) throw e;
    dash = refreshed;
    return await attempt(dash.stateVersion ?? 0);
  }
}
