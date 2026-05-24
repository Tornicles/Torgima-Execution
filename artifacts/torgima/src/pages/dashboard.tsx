import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { MainDashboardView } from "@/components/dashboard/MainDashboardView";
import { toDashboardProjection, getDashboardUiState } from "@/lib/dashboard-types";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";

export default function Dashboard() {
  const { checking } = useAppRouteGuard("post-launch");
  const { data, isLoading, isError, refetch } = useDashboardProjection();
  const [, setLocation] = useLocation();

  const projection = data ? toDashboardProjection(data) : null;
  const uiState = getDashboardUiState(projection);

  useEffect(() => {
    if (!checking && uiState === "NO_BLUEPRINT") {
      setLocation("/validate");
    }
  }, [checking, uiState, setLocation]);

  if (checking || (isLoading && !data)) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-5xl">
        <div className="h-10 bg-gray-100 rounded-lg w-72" />
        <div className="grid grid-cols-4 gap-4">
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

  if (!projection || uiState === "NO_BLUEPRINT") {
    return (
      <div className="p-8 text-center text-sm text-gray-500">Redirecting to validation…</div>
    );
  }

  return <MainDashboardView state={projection} />;
}
