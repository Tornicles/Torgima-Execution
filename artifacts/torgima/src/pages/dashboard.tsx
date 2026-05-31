import { useEffect, useState } from "react";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { MainDashboardView } from "@/components/dashboard/MainDashboardView";
import { getDashboardUiState, toDashboardProjection } from "@/lib/dashboard-types";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";

export default function Dashboard() {
  const { checking } = useAppRouteGuard("post-launch");
  const { data, isLoading, isError, refetch } = useDashboardProjection();
  const projection = data ? toDashboardProjection(data) : null;
  const uiState = getDashboardUiState(projection);
  const [syncStartedAt] = useState(() => Date.now());
  const syncTimedOut = Date.now() - syncStartedAt > 30_000;

  useEffect(() => {
    if (uiState !== "PENDING_SYNC" || syncTimedOut) return;
    const t = setInterval(() => void refetch(), 3000);
    return () => clearInterval(t);
  }, [uiState, syncTimedOut, refetch]);

  if (checking || (isLoading && !data)) {
    return (
      <div className="p-4 sm:p-8 space-y-6 animate-pulse max-w-5xl">
        <div className="h-10 bg-gray-100 rounded-lg w-full max-w-72" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
        <p className="text-gray-500 text-sm">Cannot connect to execution server.</p>
        <button type="button" onClick={() => void refetch()} className="text-green-600 underline text-sm">
          Refresh
        </button>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <p className="text-gray-500 text-sm">Loading execution state…</p>
      </div>
    );
  }

  if (
    uiState === "PENDING_SYNC" &&
    !syncTimedOut &&
    (projection.launchFirstLoad?.totalOrders ?? 0) === 0
  ) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-white p-8 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-[#0B1220]">Preparing your first 8 tasks…</p>
        <p className="mt-2 max-w-sm text-xs text-[#64748B]">
          Your blueprint is active. Foundation tasks are being generated from your validation.
        </p>
      </div>
    );
  }

  return <MainDashboardView state={projection} />;
}
