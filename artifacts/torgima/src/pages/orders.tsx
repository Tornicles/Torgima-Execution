import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useGetActiveOrders } from "@workspace/api-client-react";

export default function OrdersPage() {
  const { data: orders, isLoading, isError } = useGetActiveOrders();

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-1">Active execution orders from your blueprint.</p>
      </div>

      {isLoading && <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />}
      {isError && <p className="text-sm text-red-600">Could not load orders.</p>}

      {!isLoading && !isError && (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
          {(orders ?? []).length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No active orders.</div>
          ) : (
            (orders ?? []).map((order) => (
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
