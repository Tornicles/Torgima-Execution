import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { MainDashboardView } from "@/components/dashboard/MainDashboardView";
import { toDashboardProjection } from "@/lib/dashboard-types";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";

export default function Dashboard() {
  const { checking } = useAppRouteGuard("post-launch");
  const { data, isLoading, isError, refetch } = useDashboardProjection();
  const projection = data ? toDashboardProjection(data) : null;

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

  if (!projection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <p className="text-gray-500 text-sm">Loading execution state…</p>
      </div>
    );
  }

  return <MainDashboardView state={projection} />;
}
