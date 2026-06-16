import { useEffect, useState } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { fetchCurrentOrder, fetchOrderDetail } from "@/api/orders";
import { AcademyOrderCard } from "@/components/execution/AcademyOrderCard";
import { TaskSkeleton } from "@/components/tasks/TaskSkeleton";
import { BlockedTaskState } from "@/components/tasks/BlockedTaskState";
import { TaskExecutionScreen } from "@/components/tasks/TaskExecutionScreen";
import { FeedbackForm } from "@/components/tasks/FeedbackForm";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { parseTaskExecutionView } from "@/lib/task-feedback";
import type { TaskExecutionView } from "@/types/task-execution";

/** DOC 34 — `/tasks/:orderId` execution + feedback entry. */
export default function TaskPage() {
  const params = useParams<{ orderId: string }>();
  const search = useSearch();
  const queryOrderId = new URLSearchParams(search).get("orderId");
  const orderId = params.orderId ?? queryOrderId ?? undefined;
  const [, setLocation] = useLocation();
  const { stateVersion, invalidate } = useDashboardProjection();
  const [execution, setExecution] = useState<TaskExecutionView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let id: string | undefined = orderId;
      if (!id) {
        const current = await fetchCurrentOrder();
        const row = current.ok ? current.data?.order : null;
        id = row && typeof row.id === "string" ? row.id : undefined;
        if (!id) {
          if (!cancelled) setLoading(false);
          return;
        }
      }
      const res = await fetchOrderDetail(id);
      if (cancelled) return;
      if (!res.ok) {
        setLocation("/dashboard");
        return;
      }
      setExecution(parseTaskExecutionView(res.data));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, setLocation]);

  if (loading) {
    return <TaskSkeleton />;
  }

  if (!execution) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 text-sm">Order not found.</p>
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          className="mt-3 text-green-600 underline text-sm"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const resolvedOrderId = orderId ?? execution.orderId;

  if (execution.blocked && execution.status === "blocked") {
    return (
      <BlockedTaskState
        reason={execution.disabledReason}
        onRefresh={() => {
          invalidate();
          void fetchOrderDetail(resolvedOrderId).then((res) => {
            if (res.ok) setExecution(parseTaskExecutionView(res.data));
          });
        }}
      />
    );
  }

  if (execution.taskType === "academy") {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <AcademyOrderCard
          order={{
            id: resolvedOrderId,
            title: execution.title,
            instruction: execution.instruction,
          }}
          masteryDefinition={execution.definitionOfDone ?? undefined}
        />
        <FeedbackForm order={execution} stateVersion={stateVersion} onSuccess={invalidate} />
      </div>
    );
  }

  return (
    <TaskExecutionScreen
      order={execution}
      stateVersion={stateVersion}
      onRefresh={invalidate}
    />
  );
}
