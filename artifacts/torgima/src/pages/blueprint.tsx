import { useState } from "react";
import {
  useGetBlueprintState,
  usePauseBlueprint,
  useResumeBlueprint,
} from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Info,
  ChevronRight,
  Check,
  Lock,
  Pause,
  Play,
  Star,
  Flag,
  Shield,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";

const PHASE_LABELS = ["Foundation", "Development", "Growth", "Scale"];

function orderProgress(o: Order): number {
  if (o.status === "complete") return 100;
  if (o.status === "in_progress") return 55;
  if (o.status === "blocked") return 20;
  return 15;
}

function orderStatusLabel(o: Order): { text: string; className: string } {
  if (o.status === "complete") return { text: "Completed", className: "text-green-700 bg-green-50" };
  if (o.status === "in_progress") return { text: "In Progress", className: "text-blue-700 bg-blue-50" };
  if (o.status === "blocked") return { text: "Blocked", className: "text-amber-700 bg-amber-50" };
  return { text: "Queued", className: "text-gray-600 bg-gray-100" };
}

export default function BlueprintPage() {
  const { id } = useParams();
  const { data: state, isLoading, refetch, isError } = useGetBlueprintState(id!);
  const pauseMutation = usePauseBlueprint();
  const resumeMutation = useResumeBlueprint();
  const [pauseReason, setPauseReason] = useState("");
  const [isPauseOpen, setIsPauseOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse max-w-7xl mx-auto">
        <div className="h-10 bg-gray-100 rounded-lg w-2/3 max-w-md" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (isError || !state) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <p className="text-gray-700 font-medium">Blueprint not found</p>
        <Link href="/dashboard">
          <span className="text-green-600 font-medium cursor-pointer hover:underline">Back to dashboard</span>
        </Link>
      </div>
    );
  }

  const blueprint = state.blueprint;
  const isActive = blueprint.status === "active";
  const totalPhases = Math.max(blueprint.totalPhases ?? 4, 1);
  const currentPhase = blueprint.phase ?? 1;
  const overall = Math.round(state.phaseProgress ?? 0);
  const orders = state.activeOrders ?? [];
  const completedOrders = orders.filter((o) => o.status === "complete").length;
  const nextOrder = orders.find((o) => o.status !== "complete");

  const handlePause = () => {
    pauseMutation.mutate(
      { id: id!, data: { reason: pauseReason } },
      {
        onSuccess: () => {
          setIsPauseOpen(false);
          void refetch();
        },
      },
    );
  };

  const handleResume = () => {
    resumeMutation.mutate({ id: id! }, { onSuccess: () => void refetch() });
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <Link href="/dashboard">
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 cursor-pointer mb-3">
              <ArrowLeft className="w-4 h-4" /> Back to dashboard
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Blueprint Overview</h1>
            <Info className="w-5 h-5 text-gray-400" aria-hidden />
          </div>
          <p className="text-gray-500 text-sm mt-1">Your execution plan. Structured. Prioritized. Progressive.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 bg-white text-sm text-gray-700 shadow-sm">
            <span className="font-medium truncate max-w-[200px]">{blueprint.title}</span>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </div>
          {isActive ? (
            <Dialog open={isPauseOpen} onOpenChange={setIsPauseOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-50"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Pause blueprint</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <p className="text-sm text-gray-500">Share a short reason — it helps the system adjust.</p>
                  <Textarea
                    placeholder="Reason for pause…"
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    onClick={handlePause}
                    disabled={!pauseReason.trim() || pauseMutation.isPending}
                  >
                    Confirm pause
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : blueprint.status === "paused" ? (
            <button
              type="button"
              onClick={handleResume}
              disabled={resumeMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> Resume
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Overall Progress</p>
          <p className="text-3xl font-bold text-green-600">{overall}%</p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${overall}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Day {currentPhase * 7} of {totalPhases * 30}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Phase</p>
          <p className="text-lg font-bold text-gray-900">
            {PHASE_LABELS[Math.min(currentPhase - 1, PHASE_LABELS.length - 1)] ?? `Phase ${currentPhase}`}
          </p>
          <span className="inline-block mt-2 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            Active
          </span>
          <p className="text-xs text-gray-500 mt-2">
            Phase {currentPhase} of {totalPhases}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Projects</p>
          <p className="text-3xl font-bold text-gray-900">
            {completedOrders} / {Math.max(orders.length, 1)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Active blueprint orders</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Next Milestone</p>
          <p className="text-lg font-semibold text-gray-900 line-clamp-2">{nextOrder?.title ?? "Next task generating"}</p>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-purple-500 shrink-0" /> In execution queue
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Execution Blueprint</h2>
          <div className="space-y-4">
            {Array.from({ length: totalPhases }, (_, idx) => {
              const phaseNum = idx + 1;
              const done = phaseNum < currentPhase;
              const active = phaseNum === currentPhase;
              const locked = phaseNum > currentPhase;
              const phasePct = done ? 100 : active ? Math.round(state.phaseProgress ?? 0) : 0;
              const phaseOrders = active ? orders : [];

              return (
                <div
                  key={phaseNum}
                  className={`rounded-2xl border bg-white overflow-hidden shadow-sm ${
                    active ? "border-green-500 ring-1 ring-green-100" : "border-gray-200"
                  }`}
                >
                  <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/80">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          done
                            ? "bg-green-500 text-white"
                            : active
                              ? "bg-green-600 text-white"
                              : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {done ? <Check className="w-5 h-5" /> : locked ? <Lock className="w-4 h-4" /> : phaseNum}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">
                          Phase {phaseNum}: {PHASE_LABELS[idx] ?? `Phase ${phaseNum}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {done ? "Completed" : active ? "In motion" : "Locked until prior phases finish"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{phasePct}%</p>
                      <p className="text-xs text-gray-500">
                        {done ? `${orders.length} / ${orders.length}` : active ? `${completedOrders} / ${orders.length}` : "0 / 0"}{" "}
                        projects
                      </p>
                    </div>
                  </div>
                  {active && (
                    <div className="px-5 py-3">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${phasePct}%` }} />
                      </div>
                      {phaseOrders.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">No queued orders for this phase.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100 bg-white">
                                <th className="px-4 py-3 font-semibold">Project</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">Progress</th>
                                <th className="px-4 py-3 font-semibold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {phaseOrders.map((order) => {
                                const st = orderStatusLabel(order);
                                const pct = orderProgress(order);
                                return (
                                  <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80">
                                    <td className="px-4 py-3 font-medium text-gray-900">{order.title}</td>
                                    <td className="px-4 py-3">
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.className}`}>
                                        {st.text}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full max-w-[120px]">
                                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-gray-500">{pct}%</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <Link href={`/tasks/${order.id}`}>
                                        <span className="text-green-600 text-xs font-semibold cursor-pointer hover:underline inline-flex items-center gap-0.5">
                                          Open <ChevronRight className="w-3 h-3" />
                                        </span>
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Blueprint Summary</p>
            <div className="flex justify-center py-2">
              <div
                className="relative w-36 h-36 rounded-full flex items-center justify-center text-2xl font-bold text-gray-900"
                style={{
                  background: `conic-gradient(rgb(34 197 94) 0% ${overall}%, rgb(59 130 246) ${overall}% ${overall + 25}%, rgb(229 231 235) ${overall + 25}% 100%)`,
                }}
              >
                <div className="absolute inset-3 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                  <span className="text-2xl font-bold text-green-600">{overall}%</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">Progress</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600 mt-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" /> Completed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> In progress
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300" /> Not started
              </span>
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">
              {orders.length} active orders · {totalPhases} phases
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Upcoming Milestones</p>
            <ul className="space-y-4">
              {(nextOrder ? [nextOrder, ...orders.filter((o) => o.id !== nextOrder.id).slice(0, 2)] : orders.slice(0, 3)).map(
                (o, i) => (
                  <li key={o.id} className="flex gap-3">
                    {i === 0 ? (
                      <Star className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    ) : (
                      <Flag className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{o.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">{o.status.replace("_", " ")}</p>
                    </div>
                  </li>
                ),
              )}
              {orders.length === 0 && <li className="text-sm text-gray-500">Milestones appear as orders are generated.</li>}
            </ul>
          </div>

          <div className="rounded-2xl border border-green-100 bg-green-50/80 p-5 shadow-sm">
            <div className="flex items-start gap-2 mb-2">
              <Shield className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm font-bold text-green-900 uppercase tracking-wide">You are on track</p>
            </div>
            <p className="text-sm text-green-800 leading-relaxed">
              Your progress is aligned with your plan. Keep executing with discipline.
            </p>
            <Link href="/signals">
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white bg-gray-900 px-4 py-2.5 rounded-xl cursor-pointer hover:bg-gray-800">
                View Signals <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
