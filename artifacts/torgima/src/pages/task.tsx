import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronRight, Clock, Zap, Camera } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

type CommandCtx = {
  where?: string;
  how?: string;
  whatItUnlocks?: string;
  contributesTo?: string;
};

type OrderVm = {
  title: string;
  instruction: string;
  expectedOutput?: string | null;
  definitionOfDone?: string | null;
  whyItMatters?: string | null;
  timeEstimateMinutes?: number | null;
  proofRequired?: boolean;
  taskType?: string;
  difficulty?: string | null;
  priority?: number;
  phaseName?: string | null;
  projectName?: string | null;
  actionName?: string | null;
  commandContext?: CommandCtx;
  knowledgeObjects?: Array<{ id: string; title: string; content?: string | null }>;
};

export default function TaskPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();
  const [order, setOrder] = useState<OrderVm | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!orderId || !API_BASE_URL) return;
    fetch(`${API_BASE_URL}/api/orders/${orderId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; data?: OrderVm }) => {
        if (d.ok && d.data) setOrder(d.data);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => setTimeElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [started]);

  async function handleStart() {
    if (!orderId || !API_BASE_URL) return;
    await fetch(`${API_BASE_URL}/api/orders/${orderId}/start`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setStarted(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Order not found</p>
        <button
          type="button"
          onClick={() => setLocation("/orders")}
          className="mt-4 text-green-600 underline text-sm"
        >
          Back to orders
        </button>
      </div>
    );
  }

  const timeLimit = order.timeEstimateMinutes ?? 45;
  const timeProgress = Math.min((timeElapsed / (timeLimit * 60)) * 100, 100);
  const isOverTime = timeElapsed > timeLimit * 60;

  const commandContext = order.commandContext ?? {};

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
        <span>GOAL</span>
        <ChevronRight className="w-3 h-3" />
        <span>{order.phaseName ?? "PHASE"}</span>
        <ChevronRight className="w-3 h-3" />
        <span>{order.projectName ?? "PROJECT"}</span>
        <ChevronRight className="w-3 h-3" />
        <span>{order.actionName ?? "ACTION"}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-green-600 font-bold">THIS ORDER</span>
      </div>

      <div className="bg-gray-900 text-white rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            {order.taskType?.toUpperCase() ?? "EXECUTION ORDER"} · {order.difficulty?.toUpperCase() ?? "—"}
          </span>
          <span
            className={`text-xs font-mono px-2 py-1 rounded ${
              (order.priority ?? 0) > 5 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
            }`}
          >
            {(order.priority ?? 0) > 5 ? `PRIORITY ${order.priority}` : "STANDARD"}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{order.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {timeLimit} min guidance
          </span>
          {order.proofRequired && (
            <span className="flex items-center gap-1 text-amber-400">
              <Camera className="w-4 h-4" />
              Proof required
            </span>
          )}
        </div>
      </div>

      {started && (
        <div
          className={`rounded-xl p-4 ${isOverTime ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{isOverTime ? "Over guidance window" : "Time running"}</span>
            <span className={`font-mono font-bold ${isOverTime ? "text-red-600" : "text-green-600"}`}>
              {Math.floor(timeElapsed / 60)}:{String(timeElapsed % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="bg-white rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${isOverTime ? "bg-red-500" : "bg-green-500"}`}
              style={{ width: `${timeProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">The Order</p>
          <p className="text-gray-900 leading-relaxed">{order.instruction}</p>
        </div>

        {commandContext.where && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Where</p>
            <p className="text-sm text-gray-700">{commandContext.where}</p>
          </div>
        )}

        {commandContext.how && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">How</p>
            <p className="text-sm text-gray-700">{commandContext.how}</p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Required Output</p>
          <p className="text-sm text-gray-700">{order.expectedOutput}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Definition of Done</p>
          <p className="text-sm text-gray-700">{order.definitionOfDone}</p>
        </div>

        {order.whyItMatters && (
          <div className="border-l-4 border-green-500 pl-4 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Why This Matters</p>
            <p className="text-sm text-gray-700">{order.whyItMatters}</p>
          </div>
        )}

        {commandContext.whatItUnlocks && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl p-3">
            <Zap className="w-4 h-4 shrink-0" />
            <span>
              Completing this unlocks: <strong>{commandContext.whatItUnlocks}</strong>
            </span>
          </div>
        )}
      </div>

      {order.knowledgeObjects && order.knowledgeObjects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reference Intelligence</p>
          {order.knowledgeObjects.slice(0, 3).map((k) => (
            <div key={k.id} className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
              <p className="font-medium">{k.title}</p>
              {k.content && (
                <p className="text-gray-500 text-xs mt-1">{k.content.substring(0, 150)}…</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {!started ? (
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-gray-800 transition-all text-sm uppercase tracking-wider"
          >
            Begin Execution →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setLocation(`/feedback/${orderId}`)}
            className="flex-1 bg-green-600 text-white font-bold py-4 rounded-2xl hover:bg-green-700 transition-all text-sm uppercase tracking-wider"
          >
            Submit Completion Report →
          </button>
        )}

        <button
          type="button"
          onClick={() => orderId && setLocation(`/feedback/${orderId}`)}
          className="px-6 py-4 border border-gray-200 rounded-2xl text-sm text-gray-600 hover:bg-gray-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
