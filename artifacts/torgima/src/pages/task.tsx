import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Play, Check, ShieldAlert, Timer } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api-base";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** Shape returned by GET `/api/orders/:id` (execution server). */
export interface ApiOrderDetail {
  id: string;
  blueprintId: string;
  title: string;
  instruction: string;
  expectedOutput?: string | null;
  definitionOfDone?: string | null;
  whyItMatters?: string | null;
  difficulty?: string | null;
  taskType: string;
  timeEstimateMinutes?: number | null;
  proofRequired?: boolean;
  proofType?: string | null;
  proofDescription?: string | null;
  status: string;
  domain?: string | null;
  priority?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
}

function idempotencyKey(prefix: string): string {
  try {
    return `${prefix}:${crypto.randomUUID()}`;
  } catch {
    return `${prefix}:${Date.now()}`;
  }
}

async function readApiEnvelope<T>(res: Response): Promise<{ ok: boolean; data?: T; error?: { message?: string } }> {
  const j = (await res.json()) as { ok?: boolean; data?: T; error?: { message?: string } };
  return { ok: j.ok === true, data: j.data, error: j.error };
}

export default function TaskPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [blockReason, setBlockReason] = useState("");
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  const [completionRating, setCompletionRating] = useState(5);
  const [effortRating, setEffortRating] = useState(3);
  const [notes, setNotes] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    enabled: !!orderId && !!API_BASE_URL,
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await readApiEnvelope<ApiOrderDetail>(res);
      if (!res.ok || !body.ok || !body.data) {
        throw new Error(body.error?.message ?? "Could not load order");
      }
      return body.data;
    },
  });

  const invalidateOrder = () => queryClient.invalidateQueries({ queryKey: ["order", orderId] });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idempotencyKey("start") }),
      });
      const body = await readApiEnvelope<unknown>(res);
      if (!res.ok || !body.ok) throw new Error(body.error?.message ?? "Start failed");
    },
    onSuccess: () => void invalidateOrder(),
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/finish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey("finish"),
        }),
      });
      const body = await readApiEnvelope<unknown>(res);
      if (!res.ok || !body.ok) throw new Error(body.error?.message ?? "Could not mark complete");
    },
    onSuccess: () => {
      void invalidateOrder();
      setIsFeedbackOpen(true);
      setActionError("");
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      const desc = blockReason.trim();
      if (desc.length < 5) throw new Error("Please describe the blocker (at least 5 characters).");
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/block`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockerType: "other",
          blockerDescription: desc,
          idempotencyKey: idempotencyKey("block"),
        }),
      });
      const body = await readApiEnvelope<unknown>(res);
      if (!res.ok || !body.ok) throw new Error(body.error?.message ?? "Could not report blocker");
    },
    onSuccess: () => {
      setIsBlockOpen(false);
      setBlockReason("");
      void invalidateOrder();
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const reflectionBase = notes.trim() || `Completed task (quality ${completionRating}/5).`;
      const reflection =
        reflectionBase.length >= 10 ? reflectionBase : `${reflectionBase} — execution note.`.slice(0, 5000);
      const score = Math.min(10, Math.max(0, Math.round(completionRating * 2)));

      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completionStatus: "completed",
          score,
          reflection,
          frictionScore: effortRating,
          idempotencyKey: idempotencyKey("feedback"),
        }),
      });
      const body = await readApiEnvelope<unknown>(res);
      if (!res.ok || !body.ok) throw new Error(body.error?.message ?? "Feedback failed");
    },
    onSuccess: () => {
      setIsFeedbackOpen(false);
      setLocation(`/blueprint/${order!.blueprintId}`);
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-48" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center text-gray-600">
        <p className="mb-4">Order not found.</p>
        <Link href="/dashboard">
          <span className="text-green-600 font-medium cursor-pointer hover:underline">Back to dashboard</span>
        </Link>
      </div>
    );
  }

  const statusLabel = order.status.replace(/_/g, " ");
  const canStart = order.status === "pending";
  const canAct = order.status === "active" || order.status === "paused";
  const needsFollowUp = order.status === "needs_feedback" || order.status === "needs_proof";
  const isTerminal = ["completed", "failed", "skipped", "cancelled"].includes(order.status);

  const handleMarkComplete = () => {
    setActionError("");
    finishMutation.mutate(undefined, {
      onError: (e: Error) => setActionError(e.message),
    });
  };

  const handleBlock = () => {
    setActionError("");
    blockMutation.mutate(undefined, {
      onError: (e: Error) => setActionError(e.message),
    });
  };

  const submitFeedback = () => {
    setActionError("");
    feedbackMutation.mutate(undefined, {
      onError: (e: Error) => setActionError(e.message),
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6 pb-16">
      <Link href={`/blueprint/${order.blueprintId}`}>
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to blueprint
        </span>
      </Link>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
              {order.taskType}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
              {statusLabel}
            </span>
            {order.timeEstimateMinutes != null && (
              <span className="ml-auto flex items-center text-xs text-gray-500">
                <Timer className="w-3.5 h-3.5 mr-1" /> {order.timeEstimateMinutes} min
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{order.title}</h1>
        </div>

        <div className="px-6 py-6 space-y-5 text-sm text-gray-700">
          <p className="leading-relaxed text-gray-600 whitespace-pre-wrap">{order.instruction}</p>

          {order.definitionOfDone && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Definition of done</h2>
              <p className="whitespace-pre-wrap leading-relaxed">{order.definitionOfDone}</p>
            </div>
          )}

          {order.expectedOutput && (
            <div className="rounded-xl border border-gray-200 p-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expected output</h2>
              <p className="whitespace-pre-wrap leading-relaxed">{order.expectedOutput}</p>
            </div>
          )}

          {order.whyItMatters && (
            <div className="rounded-xl border border-green-100 bg-green-50/50 p-4 text-gray-800">
              <h2 className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2">Why it matters</h2>
              <p className="whitespace-pre-wrap leading-relaxed">{order.whyItMatters}</p>
            </div>
          )}

          {order.status === "blocked" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
              <span className="font-semibold block mb-1">Blocked</span>
              This order is paused for blocker resolution. Unblock from the blueprint or orders view when ready.
            </div>
          )}
        </div>

        <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/60 flex flex-wrap gap-3 justify-between items-center">
          {canStart && (
            <button
              type="button"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> Start task
            </button>
          )}

          {canAct && (
            <>
              <button
                type="button"
                onClick={handleMarkComplete}
                disabled={finishMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Mark complete
              </button>

              <Dialog open={isBlockOpen} onOpenChange={setIsBlockOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50"
                  >
                    <ShieldAlert className="w-4 h-4" /> Report blocker
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Report a blocker</DialogTitle>
                  </DialogHeader>
                  <div className="py-3 space-y-3">
                    <Textarea
                      placeholder="What is preventing execution? (min. 5 characters)"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <button type="button" className="text-sm text-gray-600 px-3 py-2">
                        Cancel
                      </button>
                    </DialogClose>
                    <button
                      type="button"
                      onClick={handleBlock}
                      disabled={blockMutation.isPending}
                      className="text-sm font-semibold bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      Submit
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {needsFollowUp && (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">
                {order.status === "needs_proof"
                  ? "Proof is required before feedback."
                  : "Finish is recorded — submit feedback to close the loop."}
              </p>
              {order.status === "needs_feedback" && (
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                >
                  Submit feedback
                </button>
              )}
            </div>
          )}

          {isTerminal && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Check className="w-4 h-4 text-green-600" /> Order {statusLabel}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Task feedback</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <p className="text-xs text-gray-500">
              Reflection must be at least 10 characters. We will map your ratings to the server score (0–10).
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Completion quality (1–5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCompletionRating(v)}
                    className={`w-10 h-10 rounded-lg font-bold border text-sm transition-colors ${
                      completionRating === v
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white border-gray-200 text-gray-700 hover:border-green-300"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Effort / friction (1–5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEffortRating(v)}
                    className={`w-10 h-10 rounded-lg font-bold border text-sm transition-colors ${
                      effortRating === v
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white border-gray-200 text-gray-700 hover:border-green-300"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Notes / reflection</label>
              <Textarea
                placeholder="What happened? Any friction or wins? (recommended, helps reach 10+ chars)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="text-sm text-gray-600 px-3 py-2">
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={submitFeedback}
              disabled={feedbackMutation.isPending}
              className="text-sm font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Submit & finish
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
