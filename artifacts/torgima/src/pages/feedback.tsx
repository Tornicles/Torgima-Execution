import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { FeedbackDashboardView } from "@/components/views/feedback/FeedbackDashboardView";
import { fetchOrderDetail } from "@/api/orders";
import { FeedbackForm } from "@/components/tasks/FeedbackForm";
import { TaskSkeleton } from "@/components/tasks/TaskSkeleton";
import { BlockedTaskState } from "@/components/tasks/BlockedTaskState";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { parseTaskExecutionView } from "@/lib/task-feedback";
import type { TaskExecutionView } from "@/types/task-execution";

export default function FeedbackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  if (!orderId) {
    return <FeedbackDashboardView />;
  }
  return <OrderFeedbackForm orderId={orderId} />;
}

function OrderFeedbackForm({ orderId }: { orderId: string }) {
  const [, setLocation] = useLocation();
  const { stateVersion, invalidate } = useDashboardProjection();
  const [execution, setExecution] = useState<TaskExecutionView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchOrderDetail(orderId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLocation("/dashboard");
        return;
      }
      const view = parseTaskExecutionView(res.data);
      if (!view) {
        setLocation("/dashboard");
        return;
      }
      setExecution(view);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, setLocation]);

  if (loading) return <TaskSkeleton />;

  if (!execution) return null;

  if (execution.blocked) {
    return <BlockedTaskState reason={execution.disabledReason} onRefresh={invalidate} />;
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <FeedbackForm order={execution} stateVersion={stateVersion} onSuccess={invalidate} />
    </div>
  );
}
