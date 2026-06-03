import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronRight, Clock, Zap, Camera, Play, CheckCircle2, Brain } from "lucide-react";
import { apiGet, getExecutionActiveOrder, startOrder, blockOrder } from "@/lib/torgima-api";
import { fetchOrderDetail } from "@/api/orders";
import { KnowledgeInjectionAccordion, type KnowledgeInjection } from "@/components/execution/KnowledgeInjectionAccordion";
import { ExecutionHelpPanel } from "@/components/execution/ExecutionHelpPanel";
import { AcademyOrderCard } from "@/components/execution/AcademyOrderCard";
import { TaskSkeleton } from "@/components/tasks/TaskSkeleton";
import { BlockedTaskState } from "@/components/tasks/BlockedTaskState";
import { ProofRequirement } from "@/components/tasks/ProofRequirement";
import { FeedbackForm } from "@/components/tasks/FeedbackForm";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { parseTaskExecutionView } from "@/lib/task-feedback";
import type { TaskExecutionView } from "@/types/task-execution";

type Trace = { goal?: string; plan?: string; phase?: string; project?: string; action?: string; task?: string };

type CommandCtx = {
  where?: string;
  how?: string;
  proof?: string;
  unlockConsequence?: string;
  aiPromptIfNeeded?: string | null;
  platformIfNeeded?: string | null;
  traceChain?: Trace;
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
  commandContext?: CommandCtx;
  knowledgeObjects?: Array<{ id: string; title: string; content?: string | null }>;
};

function detailToVm(data: Record<string, unknown>): OrderVm {
  const ctx = (data.commandContext ?? {}) as CommandCtx;
  return {
    title: String(data.title ?? ""),
    instruction: String(data.instruction ?? data.instructions ?? ""),
    expectedOutput: (data.expectedOutput as string | null) ?? null,
    definitionOfDone: (data.definitionOfDone as string | null) ?? null,
    whyItMatters: (data.whyItMatters as string | null) ?? null,
    timeEstimateMinutes: (data.timeEstimateMinutes as number | null) ?? null,
    proofRequired: Boolean(data.proofRequired),
    taskType: String(data.taskType ?? data.type ?? "execution"),
    difficulty: (data.difficulty as string | null) ?? null,
    priority: (data.priority as number) ?? 0,
    commandContext: ctx,
    knowledgeObjects: Array.isArray(data.knowledgeObjects)
      ? (data.knowledgeObjects as OrderVm["knowledgeObjects"])
      : undefined,
  };
}

export default function TaskPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();
  const { stateVersion, invalidate } = useDashboardProjection();
  const [order, setOrder] = useState<OrderVm | null>(null);
  const [execution, setExecution] = useState<TaskExecutionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [whySummary, setWhySummary] = useState<string | null>(null);
  const [knowledgeInjection, setKnowledgeInjection] = useState<KnowledgeInjection | null>(null);

  useEffect(() => {
    if (!orderId) return;
    void fetchOrderDetail(orderId)
      .then((res) => {
        if (!res.ok) {
          setLocation("/dashboard");
          return;
        }
        const data = res.data ?? {};
        setOrder(detailToVm(data));
        setExecution(parseTaskExecutionView(data));
      })
      .finally(() => setLoading(false));

    void apiGet<{ summary?: string }>(`/api/orders/${orderId}/decision-trace`)
      .then((d) => {
        if (d?.summary) setWhySummary(d.summary);
      })
      .catch(() => null);

    void getExecutionActiveOrder()
      .then((d) => {
        const inj = (d as { knowledgeInjection?: KnowledgeInjection }).knowledgeInjection;
        if (inj) setKnowledgeInjection(inj);
      })
      .catch(() => null);
  }, [orderId, setLocation]);

  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => setTimeElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [started]);

  async function handleStart() {
    if (!orderId) return;
    await startOrder(orderId).catch(() => null);
    setStarted(true);
  }

  function copyAIPrompt() {
    const prompt = order?.commandContext?.aiPromptIfNeeded;
    if (!prompt || typeof prompt !== "string") return;
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return <TaskSkeleton />;
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 text-sm">Order not found.</p>
        <button type="button" onClick={() => setLocation("/orders")} className="mt-3 text-green-600 underline text-sm">
          Return to execution queue
        </button>
      </div>
    );
  }

  if (execution?.blocked) {
    return (
      <BlockedTaskState
        reason={execution.disabledReason}
        onRefresh={() => {
          invalidate();
          if (!orderId) return;
          void fetchOrderDetail(orderId).then((res) => {
            if (res.ok) setExecution(parseTaskExecutionView(res.data));
          });
        }}
      />
    );
  }

  const timeLimit = order.timeEstimateMinutes ?? 45;
  const timeProgress = Math.min((timeElapsed / (timeLimit * 60)) * 100, 100);
  const isOverTime = timeElapsed > timeLimit * 60;
  const ctx = order.commandContext ?? {};
  const trace = ctx.traceChain ?? {};

  if (order.taskType === "academy") {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <AcademyOrderCard
          order={{
            id: orderId!,
            title: order.title,
            instruction: order.instruction,
          }}
          masteryDefinition={order.definitionOfDone ?? undefined}
        />
        <ExecutionHelpPanel orderId={orderId!} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-400 font-mono">
        {trace.goal ? (
          <>
            <span className="text-gray-700 max-w-[10rem] truncate">{trace.goal}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
          </>
        ) : null}
        {trace.plan ? (
          <>
            <span className="max-w-[8rem] truncate">{trace.plan}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
          </>
        ) : null}
        {trace.phase ? (
          <>
            <span className="max-w-[8rem] truncate">{trace.phase}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
          </>
        ) : null}
        {trace.project ? (
          <>
            <span className="max-w-[8rem] truncate">{trace.project}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
          </>
        ) : null}
        {trace.action ? (
          <>
            <span className="max-w-[8rem] truncate">{trace.action}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
          </>
        ) : null}
        <span className="text-green-600 font-bold">THIS ORDER</span>
      </div>

      <div className="bg-gray-900 text-white rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              {order.taskType?.toUpperCase() ?? "EXECUTION ORDER"}
            </span>
            <span className="text-xs font-mono text-gray-500">·</span>
            <span className="text-xs font-mono text-gray-400 uppercase">{order.difficulty?.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            {(order.priority ?? 0) > 0 ? (
              <span className="text-xs font-mono bg-red-500/20 text-red-400 px-2 py-1 rounded">
                PRIORITY {order.priority}
              </span>
            ) : null}
            {order.proofRequired ? (
              <span className="text-xs font-mono bg-amber-500/20 text-amber-400 px-2 py-1 rounded flex items-center gap-1">
                <Camera className="w-3 h-3" />
                PROOF REQUIRED
              </span>
            ) : null}
          </div>
        </div>

        <h1 className="text-2xl font-bold">{order.title}</h1>

        <button
          type="button"
          onClick={() => setWhyOpen((v) => !v)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <Brain className="w-3.5 h-3.5" />
          Why this Order?
        </button>
        {whyOpen && (
          <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-green-500 pl-3">
            {whySummary ??
              "Selected from your active blueprint chain based on condition, enforcement package, and current phase priority."}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {timeLimit} min guidance
          </span>
        </div>
      </div>

      {started ? (
        <div className={`rounded-xl p-4 border ${isOverTime ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase">
              {isOverTime ? "Over guidance window" : "Execution timer"}
            </span>
            <span className={`font-mono font-bold text-lg ${isOverTime ? "text-red-600" : "text-gray-900"}`}>
              {Math.floor(timeElapsed / 60)}:{String(timeElapsed % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="bg-white rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${isOverTime ? "bg-red-500" : "bg-green-500"}`}
              style={{ width: `${timeProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="bg-white border-2 border-gray-900 rounded-2xl p-6 space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">The order</p>
          <p className="text-gray-900 text-base leading-relaxed font-medium">{order.instruction}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ctx.where ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">Where</p>
              <p className="text-sm text-gray-700">{ctx.where}</p>
            </div>
          ) : null}
          {ctx.how ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">How</p>
              <p className="text-sm text-gray-700">{ctx.how}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">Required output</p>
          <p className="text-sm text-gray-700">{order.expectedOutput}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">Definition of done</p>
          <p className="text-sm text-gray-700">{order.definitionOfDone}</p>
        </div>

        {execution ? (
          <ProofRequirement
            proofType={execution.proofType}
            instruction={execution.proofInstruction}
          />
        ) : ctx.proof ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider font-mono flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Proof requirement
            </p>
            <p className="text-sm text-amber-800">{ctx.proof}</p>
          </div>
        ) : null}

        {order.whyItMatters ? (
          <div className="border-l-4 border-green-500 pl-4 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">Strategic reason</p>
            <p className="text-sm text-gray-700">{order.whyItMatters}</p>
          </div>
        ) : null}

        {ctx.unlockConsequence ? (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
            <Zap className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase font-mono mb-0.5">Progression coupling</p>
              <p className="text-sm text-green-800">{ctx.unlockConsequence}</p>
            </div>
          </div>
        ) : null}
      </div>

      {ctx.aiPromptIfNeeded ? (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider font-mono">Optional AI prompt</p>
            </div>
            <button
              type="button"
              onClick={copyAIPrompt}
              className="text-xs text-blue-600 border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-100 font-mono shrink-0"
            >
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <p className="text-sm text-blue-800 font-mono leading-relaxed bg-white rounded-lg p-3 border border-blue-100 whitespace-pre-wrap">
            {ctx.aiPromptIfNeeded}
          </p>
        </div>
      ) : null}

      {ctx.platformIfNeeded ? (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <span className="text-xs font-semibold text-gray-500 uppercase font-mono">Platform:</span>
          <span className="text-sm font-medium text-gray-900">{ctx.platformIfNeeded}</span>
        </div>
      ) : null}

      <KnowledgeInjectionAccordion injection={knowledgeInjection} />

      {orderId ? <ExecutionHelpPanel orderId={orderId} /> : null}

      {order.knowledgeObjects && order.knowledgeObjects.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">Intelligence context</p>
          {order.knowledgeObjects.slice(0, 3).map((k) => (
            <div key={k.id} className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-gray-900">{k.title}</p>
              {k.content ? <p className="text-xs text-gray-500">{String(k.content).substring(0, 200)}...</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-3">
        {!started ? (
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-gray-800 transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Begin execution
          </button>
        ) : (
          <a
            href={`#execution-report`}
            className="flex-1 bg-green-600 text-white font-bold py-4 rounded-2xl hover:bg-green-700 transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 no-underline"
          >
            <CheckCircle2 className="w-4 h-4" />
            Submit execution report
          </a>
        )}
        <button
          type="button"
          onClick={async () => {
            if (!orderId) return;
            await blockOrder(orderId, {
              reason:
                "Execution blocked from Order screen — dependency or resource gap.",
            });
            setLocation("/dashboard");
          }}
          className="px-5 py-4 border border-orange-200 text-orange-700 rounded-2xl text-sm hover:bg-orange-50 font-mono"
        >
          Report blocked
        </button>
      </div>

      {started && execution ? (
        <div id="execution-report" className="scroll-mt-6">
          <FeedbackForm
            order={execution}
            stateVersion={stateVersion}
            onSuccess={invalidate}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
