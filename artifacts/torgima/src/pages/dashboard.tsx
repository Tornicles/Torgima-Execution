import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { DashboardStateRouter } from "@/components/dashboard/DashboardStateRouter";
import { DashboardRightPanel } from "@/components/dashboard/DashboardRightPanel";
import { toDashboardProjection } from "@/lib/dashboard-types";

export default function Dashboard() {
  const { data, isLoading, isError, isFetching, refetch } = useDashboardProjection();

  if (isLoading && !data) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-5xl">
        <div className="h-10 bg-gray-100 rounded-lg w-72" />
        <div className="h-40 bg-gray-100 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-28 bg-gray-100 rounded-xl" />
          <div className="h-28 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
        <p className="text-gray-500 text-sm">Cannot connect to execution server.</p>
        <button type="button" onClick={() => void refetch()} className="text-green-600 underline text-sm">
          Refresh
        </button>
      </div>
    );
  }

  const projection = toDashboardProjection(data!);

  return (
    <div className="flex min-h-full">
      <div className="flex-1 p-6 lg:p-8 max-w-5xl">
        <DashboardStateRouter
          state={projection}
          isError={isError}
          isFetching={isFetching}
          refetch={() => void refetch()}
        />
      </div>
      <DashboardRightPanel state={projection} />
    </div>
  );
}
