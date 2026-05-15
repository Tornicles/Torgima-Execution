import { useMemo } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useGetActiveOrders } from "@workspace/api-client-react";
import { OperationalAwarenessStrip } from "@/components/operational/OperationalAwarenessStrip";
import { useBlueprintStore } from "@/store/blueprintStore";

/** Server returns `{ order: Task | null }`; OpenAPI may still type this as `Order[]`. */
function normalizeActiveOrders(raw: unknown): { id: string; title: string; status: string }[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((o): o is { id: string; title: string; status: string } => !!o && typeof o === "object" && "id" in o);
  }
  if (typeof raw === "object" && "order" in (raw as object)) {
    const o = (raw as { order: { id: string; title: string; status: string } | null }).order;
    return o ? [o] : [];
  }
  return [];
}

export default function OrdersPage() {
  const { data: rawOrders, isLoading, isError } = useGetActiveOrders();
  const orders = useMemo(() => normalizeActiveOrders(rawOrders as unknown), [rawOrders]);
  const dash = useBlueprintStore((s) => s.dashboardProjection);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Execution orders</h1>
        <p className="text-sm text-gray-500 mt-1">Active execution orders from your blueprint.</p>
      </div>

      <OperationalAwarenessStrip
        awareness={dash?.operationalAwareness as string[] | undefined}
        signalBridge={dash?.signalBlueprintBridge as Array<{ headline?: string; cite?: string }> | undefined}
        executionIdentity={dash?.executionIdentityLines as string[] | undefined}
      />

      {isLoading && <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />}
      {isError && <p className="text-sm text-red-600">Could not load orders.</p>}

      {!isLoading && !isError && (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No active orders.</div>
          ) : (
            orders.map((order) => (
              <Link key={order.id} href={`/tasks/${order.id}`}>
                <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">{order.title}</p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">{order.status.replace("_", " ")}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
