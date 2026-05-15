import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBlueprintCommandCenterQueryKey,
  useGetBlueprintCommandCenter,
  usePauseBlueprint,
  useResumeBlueprint,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  Pause,
  Play,
  Target as TargetIcon,
  GitBranch,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OperationalAwarenessStrip } from "@/components/operational/OperationalAwarenessStrip";

/** Mirrors `ExecutionCommandCenterDTO` JSON from the API (camelCase). */
interface OrderTraceDTO {
  orderId: string;
  title: string;
  status: string;
  proofRequired: boolean;
  upstream: {
    goal: string;
    planId: string | null;
    planName: string | null;
    targetId: string | null;
    targetName: string | null;
    phaseId: string | null;
    phaseName: string | null;
    projectId: string | null;
    projectName: string | null;
    actionId: string | null;
    actionName: string | null;
  };
  downward: {
    whyItMatters: string | null;
    generationReason: string | null;
    conditionAtGeneration: string | null;
  };
  lockReasons: string[];
}

interface HierarchyAction {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  locked: boolean;
  lockNotes: string[];
  progressOrders: { completed: number; total: number };
  orders: OrderTraceDTO[];
}

interface HierarchyProject {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  blockedFlag: boolean;
  blockedReason: string | null;
  locked: boolean;
  lockNotes: string[];
  actions: HierarchyAction[];
}

interface HierarchyPhase {
  id: string;
  name: string;
  status: string;
  lockedDb: boolean;
  gatePassed: boolean;
  unlockRequirements: string[];
  strategicPurpose: string;
  progressionPctOrders: number;
  projects: HierarchyProject[];
  signalsApply: string;
}

interface HierarchyPlan {
  id: string;
  name: string;
  description: string | null;
  status: string;
  purposeLine: string;
  unlockSummary: string;
  failureImpact: string;
  completionPct: number;
  linkedTargetIds: string[];
  phases: HierarchyPhase[];
}

interface CommandCenterPayload {
  blueprintId: string;
  blueprintStatus: string;
  blueprintType?: {
    tier: string | null;
    mode: string | null;
    intelligenceDepth: string | null;
    allowedSystems: string[];
    lockedSystems: string[];
  };
  pausedAt: string | null;
  pauseReason: string | null;
  detachedOrders: OrderTraceDTO[];
  mission: {
    rawGoal: string;
    purpose: string | null;
    strategicIntentSummary: string | null;
    domain: string | null;
    timeframeLabel: string | null;
    currentCondition: string | null;
    executionStatus: string;
    progressionSummary: string;
    momentumSummary: string;
    executionImplication: string | null;
    strongestAngle: string | null;
    biggestVulnerability: string | null;
    primaryStrategicWarnings: string[];
  };
  policies: Array<{ code: string; description: string; source: string }>;
  hierarchy: HierarchyPlan[];
  targets: Array<{
    id: string;
    name: string;
    description: string | null;
    type: string;
    status: string;
    currentValue: number;
    targetValue: number | null;
    unit: string | null;
    progress: number;
    planId: string | null;
    planName: string | null;
    linkedPhaseIds: string[];
    linkedProjectIds: string[];
    emphasis: string[];
    riskState: string;
    whyMatters: string;
    consequenceIfMissed: string;
    unlockHint: string;
  }>;
  dependencyEdges: Array<{
    relation: string;
    blockingId: string;
    blockingLabel: string;
    blockedId: string;
    blockedLabel: string;
  }>;
  signalBridge: { lines: Array<{ headline: string; cite: string }> };
  strategicContinuity: {
    validationVerdict: string | null;
    validationSummary: string | null;
    selectedPath: string | null;
    intelligenceEmphasis: string[];
    seedingInstructionsVisible: string | null;
  };
  ownership: { lines: string[] };
  operationalAwareness: string[];
}

function statusBadge(status: string) {
  const s = status.toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    skipped: "bg-slate-100 text-slate-700 ring-slate-200",
    active: "bg-sky-50 text-sky-800 ring-sky-200",
    paused: "bg-amber-50 text-amber-900 ring-amber-200",
    blocked: "bg-red-50 text-red-800 ring-red-200",
    pending: "bg-gray-50 text-gray-700 ring-gray-200",
    needs_feedback: "bg-violet-50 text-violet-900 ring-violet-200",
    needs_proof: "bg-orange-50 text-orange-900 ring-orange-200",
  };
  const cls = map[s] ?? "bg-gray-50 text-gray-800 ring-gray-200";
  return (
    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md ring-1 ${cls}`}>{status}</span>
  );
}

function OrderTraceChip({ ot }: { ot: OrderTraceDTO }) {
  const u = ot.upstream;
  const chainParts = [
    u.planName ?? "Plan",
    u.phaseName ?? "Phase",
    u.projectName ?? "Project",
    u.actionName ?? "Action",
  ];
  const chainLabel = [...new Set(chainParts)].join(" → ");
  const traceUp = `${ot.title} traces: Goal → … → ${chainLabel}`;

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 text-sm shadow-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">{ot.title}</p>
          <p className="text-[11px] font-mono text-slate-500 mt-1 break-words">{traceUp}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ot.proofRequired ? (
            <span className="text-[10px] uppercase font-bold text-orange-700">Proof linked</span>
          ) : null}
          {statusBadge(ot.status)}
          <Link href={`/tasks/${ot.orderId}`}>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">
              Execute <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>
      {ot.lockReasons.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-100 px-2 py-1.5 text-xs text-amber-950 space-y-0.5">
          <span className="font-bold uppercase tracking-wide text-[10px] text-amber-900">Locks (deterministic)</span>
          {ot.lockReasons.map((lr) => (
            <p key={lr}>{lr}</p>
          ))}
        </div>
      )}
      {(ot.downward.generationReason || ot.downward.whyItMatters || ot.downward.conditionAtGeneration) && (
        <div className="text-xs text-slate-600 space-y-1 border-t border-slate-50 pt-2">
          {ot.downward.conditionAtGeneration && (
            <p>
              <span className="font-semibold text-slate-700">Condition at emission:</span> {ot.downward.conditionAtGeneration}
            </p>
          )}
          {ot.downward.generationReason && (
            <p>
              <span className="font-semibold text-slate-700">Emission rationale:</span> {ot.downward.generationReason}
            </p>
          )}
          {ot.downward.whyItMatters && (
            <p>
              <span className="font-semibold text-slate-700">Operational tie-in:</span> {ot.downward.whyItMatters}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BlueprintPage() {
  const { id } = useParams();
  const bpId = id ?? "";
  const queryClient = useQueryClient();
  const { data: raw, isLoading, isError, refetch } = useGetBlueprintCommandCenter(bpId, {
    query: { enabled: bpId.length > 0 } as never,
  });
  const cc = raw as CommandCenterPayload | undefined;

  const pauseMutation = usePauseBlueprint();
  const resumeMutation = useResumeBlueprint();
  const [pauseReason, setPauseReason] = useState("");
  const [isPauseOpen, setIsPauseOpen] = useState(false);

  const invalidateCc = async () => {
    if (!bpId) return;
    await queryClient.invalidateQueries({ queryKey: getGetBlueprintCommandCenterQueryKey(bpId) });
  };

  const handlePause = () => {
    if (!bpId) return;
    pauseMutation.mutate(
      { id: bpId, data: { reason: pauseReason } },
      {
        onSuccess: () => {
          setIsPauseOpen(false);
          void invalidateCc().then(() => refetch());
        },
      },
    );
  };

  const handleResume = () => {
    if (!bpId) return;
    resumeMutation.mutate({ id: bpId }, { onSuccess: () => void invalidateCc().then(() => refetch()) });
  };

  if (isLoading || !bpId) {
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

  if (isError || !cc) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <p className="text-gray-700 font-medium">Blueprint command center unavailable</p>
        <Link href="/dashboard">
          <span className="text-green-600 font-medium cursor-pointer hover:underline">Back to dashboard</span>
        </Link>
      </div>
    );
  }

  const isActive = cc.blueprintStatus === "active";
  const signalLines = cc.signalBridge?.lines ?? [];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <Link href="/dashboard">
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 cursor-pointer mb-3">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </span>
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Blueprint command center</h1>
          {cc.blueprintType?.tier && (
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
                {cc.blueprintType.tier} tier
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 ring-1 ring-sky-200">
                {cc.blueprintType.mode} mode
              </span>
              {cc.blueprintType.intelligenceDepth && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                  {cc.blueprintType.intelligenceDepth} depth
                </span>
              )}
            </div>
          )}
          <p className="text-slate-500 text-sm mt-2 max-w-2xl">
            Full execution machine: mission, control policies, hierarchy, locks, signals, targets, and order traceability
            sourced from persisted blueprint state — not illustrative data.
          </p>
          {cc.pauseReason ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3">
              Pause note: {cc.pauseReason}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {isActive ? (
            <Dialog open={isPauseOpen} onOpenChange={setIsPauseOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 text-amber-900 text-sm font-semibold hover:bg-amber-50"
                >
                  <Pause className="w-4 h-4" /> Pause blueprint
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Pause blueprint</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-slate-500">
                  Pause is recorded as operational fact; conditions and progression remain governed by control systems.
                </p>
                <Textarea
                  placeholder="Pause rationale (persisted)"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="min-h-[100px]"
                />
                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="button" onClick={handlePause} disabled={!pauseReason.trim() || pauseMutation.isPending}>
                    Confirm pause
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : cc.blueprintStatus === "paused" ? (
            <button
              type="button"
              onClick={handleResume}
              disabled={resumeMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> Resume blueprint
            </button>
          ) : null}
          <Link href="/signals">
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer">
              Signals <ExternalLink className="w-3.5 h-3.5 opacity-50" />
            </span>
          </Link>
        </div>
      </div>

      <OperationalAwarenessStrip
        awareness={cc.operationalAwareness}
        signalBridge={signalLines}
        executionIdentity={cc.ownership?.lines}
      />

      {/* Mission */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Mission layer</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
          <Field label="Raw goal" value={cc.mission.rawGoal} />
          <Field label="Purpose" value={cc.mission.purpose ?? "—"} />
          <Field label="Strategic intent (validation / intelligence)" value={cc.mission.strategicIntentSummary ?? "—"} />
          <Field label="Domain" value={cc.mission.domain ?? "—"} />
          <Field label="Time horizon" value={cc.mission.timeframeLabel ?? "—"} />
          <Field label="Current condition (control)" value={cc.mission.currentCondition ?? "—"} />
          <Field label="Execution status" value={cc.mission.executionStatus} />
          <Field label="Progression" value={cc.mission.progressionSummary} />
          <Field label="Momentum / signal snapshot" value={cc.mission.momentumSummary} />
          <Field label="Execution implication (intelligence-only)" value={cc.mission.executionImplication ?? "—"} />
          <Field label="Strongest angle (intelligence framing)" value={cc.mission.strongestAngle ?? "—"} />
          <Field label="Largest vulnerability" value={cc.mission.biggestVulnerability ?? "—"} />
          {cc.mission.primaryStrategicWarnings.length ? (
            <div className="md:col-span-2 xl:col-span-3 rounded-xl bg-red-50 border border-red-100 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-red-900 mb-2">Primary strategic warnings</p>
              <ul className="list-disc pl-5 text-red-900 space-y-1">
                {cc.mission.primaryStrategicWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {/* Policies */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Policy / control layer</h2>
        </div>
        <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
          {cc.policies.map((p) => (
            <div key={`${p.code}-${p.description}`} className="px-5 py-3 flex flex-col md:flex-row md:items-start gap-2">
              <span className="text-xs font-mono font-bold text-emerald-800 shrink-0">{p.code}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800">{p.description}</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">Source: {p.source}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Signal bridge */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Signal → blueprint visibility</h2>
        {signalLines.length === 0 ? (
          <p className="text-sm text-slate-500">
            Insufficient persisted condition / snapshot linkage to derive explanations — telemetry will deepen as execution
            emits feedback.
          </p>
        ) : (
          <ul className="space-y-3">
            {signalLines.map((line) => (
              <li key={`${line.headline}-${line.cite}`} className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-900">{line.headline}</p>
                <p className="text-xs text-slate-500 font-mono mt-2">{line.cite}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Strategic continuity */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3">
        <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wider">Strategic continuity metadata</h2>
        <div className="grid md:grid-cols-2 gap-3 text-sm text-emerald-950">
          <p>
            <span className="font-semibold">Validation verdict:</span> {cc.strategicContinuity.validationVerdict ?? "—"}
          </p>
          <p>
            <span className="font-semibold">Selected path:</span> {cc.strategicContinuity.selectedPath ?? "—"}
          </p>
        </div>
        {cc.strategicContinuity.validationSummary && (
          <p className="text-sm text-emerald-900 border-t border-emerald-200/60 pt-3">{cc.strategicContinuity.validationSummary}</p>
        )}
        {cc.strategicContinuity.seedingInstructionsVisible && (
          <div className="rounded-xl bg-white/80 border border-emerald-100 p-4 text-sm text-slate-800">
            <p className="text-[11px] font-bold uppercase text-emerald-800 mb-1">Visible seeding instructions (stored)</p>
            <p>{cc.strategicContinuity.seedingInstructionsVisible}</p>
          </div>
        )}
        {cc.strategicContinuity.intelligenceEmphasis.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-emerald-950 space-y-1">
            {cc.strategicContinuity.intelligenceEmphasis.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Targets */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TargetIcon className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Target visibility</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cc.targets.length === 0 ? (
            <p className="text-sm text-slate-500 col-span-full">No targets persisted for this blueprint.</p>
          ) : (
            cc.targets.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{t.name}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-1">
                      Type: {t.type} · Risk: {t.riskState}
                    </p>
                  </div>
                  {statusBadge(t.status)}
                </div>
                {t.description && <p className="text-sm text-slate-600">{t.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Current</span>
                    {t.currentValue}
                    {t.unit ? ` ${t.unit}` : ""}
                  </div>
                  <div>
                    <span className="text-slate-400 block">Required</span>
                    {t.targetValue != null ? `${t.targetValue}${t.unit ? ` ${t.unit}` : ""}` : "—"}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Progress (persisted metric)</span>
                    {formatTargetProgressDisplay(t.progress)}
                  </div>
                </div>
                <div className="text-xs space-y-1 border-t border-slate-100 pt-3 text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Why it matters:</span> {t.whyMatters}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">If missed:</span> {t.consequenceIfMissed}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Unlock hint:</span> {t.unlockHint}
                  </p>
                  {t.planName && (
                    <p className="font-mono text-[11px] text-slate-500">Plan: {t.planName}</p>
                  )}
                </div>
                {t.emphasis.length > 0 && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-800 space-y-1">
                    {t.emphasis.map((e) => (
                      <p key={e}>{e}</p>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Dependencies */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Dependency & lock graph (edges)</h2>
        </div>
        {cc.dependencyEdges.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No persisted project or order dependency edges.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Relation</th>
                  <th className="px-4 py-3">Blocking</th>
                  <th className="px-4 py-3">Blocked</th>
                </tr>
              </thead>
              <tbody>
                {cc.dependencyEdges.map((e) => (
                  <tr key={`${e.relation}-${e.blockingId}-${e.blockedId}`} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-xs">{e.relation}</td>
                    <td className="px-4 py-2">{e.blockingLabel}</td>
                    <td className="px-4 py-2">{e.blockedLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Hierarchy */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">
          Hierarchy: Goal → Plans → Targets (via cards above) → Phases → Projects → Actions → Orders
        </h2>
        <p className="text-sm text-slate-500">
          Expand rows to inspect lock rationale, progression from real order completions, and per-order upward trace.
        </p>
        <div className="space-y-4">
          {cc.hierarchy.map((plan, pi) => (
            <Collapsible key={plan.id} defaultOpen={pi === 0} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 bg-slate-50/90 hover:bg-slate-50 text-left">
                <div>
                  <p className="font-bold text-slate-900">{plan.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Completion (phase terminal ratio): <span className="font-mono">{plan.completionPct}%</span> · Targets:{" "}
                    {plan.linkedTargetIds?.length ?? 0}
                  </p>
                  <p className="text-xs text-emerald-800 mt-2 max-w-3xl">{plan.purposeLine}</p>
                </div>
                <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 transition-transform aria-expanded:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-5 pt-3 space-y-3 border-t border-slate-100">
                  <div className="grid md:grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
                    <p>
                      <span className="font-semibold text-slate-800">Unlock framing:</span> {plan.unlockSummary}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Failure consequence framing:</span> {plan.failureImpact}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {plan.phases.map((ph, hi) => (
                      <Collapsible key={ph.id} defaultOpen={hi === 0} className="rounded-xl border border-slate-100 overflow-hidden ml-2">
                        <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50/80">
                          {(ph.lockedDb || ph.unlockRequirements.length > 0) && <Lock className="w-4 h-4 text-amber-600 shrink-0" />}
                          <div className="text-left flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900">{ph.name}</span>
                              {statusBadge(ph.status)}
                              <span className="text-[11px] font-mono text-slate-500">
                                Orders progress: {ph.progressionPctOrders}%
                              </span>
                              {ph.gatePassed ? (
                                <span className="text-[10px] font-bold uppercase text-emerald-700">Gate cleared</span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{ph.signalsApply}</p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t border-slate-50 bg-slate-50/60 px-4 py-4 space-y-4 text-sm">
                            <div className="rounded-xl bg-white border border-slate-100 p-4 text-xs space-y-2">
                              <p>
                                <span className="font-bold text-slate-800 uppercase text-[11px]">Why this phase exists</span>
                              </p>
                              <p className="text-slate-700">{ph.strategicPurpose}</p>
                              <p className="font-semibold text-slate-900 mt-2">Unlock / block cues</p>
                              {ph.unlockRequirements.length === 0 ? (
                                <p className="text-slate-500">No additional structural locks beyond normal progression.</p>
                              ) : (
                                <ul className="list-disc pl-5 text-slate-800 space-y-1">
                                  {ph.unlockRequirements.map((u) => (
                                    <li key={u}>{u}</li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div className="space-y-3">
                              {ph.projects.map((pj) => (
                                <Collapsible key={pj.id} defaultOpen={false} className="rounded-xl border border-slate-100 bg-white">
                                  <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                                    {pj.locked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : null}
                                    <div className="text-left flex-1 min-w-0">
                                      <span className="font-medium text-slate-900">{pj.name}</span>
                                      <span className="ml-2">{statusBadge(pj.status)}</span>
                                      {pj.blockedFlag ? (
                                        <span className="ml-2 text-[10px] font-bold uppercase text-red-700">
                                          Administrative block flag
                                        </span>
                                      ) : null}
                                    </div>
                                    <ChevronDown className="w-4 h-4 shrink-0" />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="border-t border-slate-50 p-4 space-y-3 text-xs">
                                      {pj.blockedReason && (
                                        <p className="text-red-900 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{pj.blockedReason}</p>
                                      )}
                                      {pj.lockNotes.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="font-bold text-slate-700">Project lock explanations</p>
                                          {pj.lockNotes.map((n) => (
                                            <p key={n} className="text-slate-600">
                                              {n}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                      {pj.actions.map((ac) => (
                                        <div key={ac.id} className="rounded-xl border border-slate-100 p-4 space-y-3">
                                          <div className="flex flex-wrap gap-2 items-center justify-between">
                                            <div className="min-w-0">
                                              <span className="font-semibold text-slate-900">{ac.name}</span>
                                              <span className="ml-2">{statusBadge(ac.status)}</span>
                                              <p className="text-[11px] font-mono text-slate-500 mt-1">
                                                Orders closed: {ac.progressOrders.completed} / {ac.progressOrders.total}
                                              </p>
                                            </div>
                                          </div>
                                          {ac.lockNotes.length > 0 && (
                                            <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-950 space-y-1">
                                              {ac.lockNotes.map((ln) => (
                                                <p key={ln}>{ln}</p>
                                              ))}
                                            </div>
                                          )}
                                          <div className="space-y-2">
                                            {ac.orders.length === 0 ? (
                                              <p className="text-slate-400">No orders linked to this action yet.</p>
                                            ) : (
                                              ac.orders.map((ot) => <OrderTraceChip key={ot.orderId} ot={ot} />)
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                      {pj.actions.length === 0 && <p className="text-slate-400 italic">No actions under this project.</p>}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </section>

      {/* Detached orders */}
      {cc.detachedOrders.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 space-y-3">
          <h2 className="text-sm font-bold text-amber-950 uppercase tracking-wider">
            Orders without action linkage (still traced)
          </h2>
          <p className="text-xs text-amber-900">
            These orders exist on the blueprint but are not mapped to an `action_id` row — downstream UI still resolves plan /
            phase / project when foreign keys exist on the order.
          </p>
          <div className="grid gap-2">
            {cc.detachedOrders.map((ot) => (
              <OrderTraceChip key={ot.orderId} ot={ot} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Psychological execution ownership (observed counters)
        </h2>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          {(cc.ownership?.lines ?? []).map((ln) => (
            <li key={ln}>{ln}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-900 mt-2 whitespace-pre-wrap break-words">{value}</p>
    </div>
  );
}

function formatTargetProgressDisplay(progress: number): string {
  if (Number.isNaN(progress)) return "—";
  // Heuristic: 0–1.05 treated as fractional; larger values printed as blueprint-stored %
  if (progress >= 0 && progress <= 1.05) {
    return `${(progress * 100).toFixed(1)}% (normalized from 0–1 field)`;
  }
  return `${progress.toFixed(1)} (raw persisted value)`;
}
