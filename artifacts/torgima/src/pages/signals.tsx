import { useEffect } from "react";
import { useLocation } from "wouter";
import { SignalsDashboardView } from "@/components/views/signals/SignalsDashboardView";
import { PanelSkeleton } from "@/components/signals/PanelSkeleton";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";

export default function SignalsPage() {
  const [, setLocation] = useLocation();
  const { projection, pendingSync, isLoading, isFetching, invalidate, lastFetchedAt } =
    useDashboardProjection();

  useEffect(() => {
    if (!isLoading && projection && !projection.activeBlueprint) {
      setLocation("/onboarding");
    }
  }, [isLoading, projection, setLocation]);

  if (isLoading && !projection) {
    return <PanelSkeleton />;
  }

  if (!projection?.activeBlueprint) {
    return <PanelSkeleton />;
  }

  return (
    <SignalsDashboardView
      projection={projection}
      pendingSync={pendingSync || isFetching}
      lastFetchedAt={lastFetchedAt}
      onRefresh={invalidate}
    />
  );
}
