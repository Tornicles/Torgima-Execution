import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { applyExecutionLanguage } from "@/lib/execution-language";

export interface OrderCardProps {
  order: {
    id: string;
    title?: string;
    instruction?: string;
    status?: string;
  };
  compact?: boolean;
}

export function OrderCard({ order, compact }: OrderCardProps) {
  const title = applyExecutionLanguage(order.title ?? "Active Order");
  const instruction = order.instruction ?
    applyExecutionLanguage(order.instruction)
  : "Execute this Order to maintain execution continuity.";

  return (
    <section className="rounded-2xl border-2 border-gray-900 bg-white p-6 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">Active Order</p>
          <h2 className="text-xl font-bold text-gray-900 mt-1">{title}</h2>
        </div>
        {order.status ? (
          <span className="text-xs font-mono uppercase text-gray-500">{order.status}</span>
        ) : null}
      </div>
      {!compact && (
        <p className="text-sm text-gray-600 line-clamp-3">{instruction}</p>
      )}
      <Link href={`/tasks/${order.id}`}>
        <span className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-gray-800 cursor-pointer">
          Execute this Order
          <ChevronRight className="w-4 h-4" />
        </span>
      </Link>
    </section>
  );
}
