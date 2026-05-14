import type { ComponentType } from "react";
import type { DashboardState } from "@workspace/api-client-react";
import { AlertTriangle, Activity, ArrowRight, Clock, Play, Target, Zap } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConditionalScreen } from "@/components/dashboard/ConditionalScreens";
import { ConditionBadge } from "@/components/ConditionBadge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";

export default function Dashboard() {
  const { data: state, isLoading, isFetching } = useDashboardProjection();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 font-mono text-center p-8">
        <p className="text-muted-foreground">Cannot connect to execution server.</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Make sure the API server is running. Check your connection and try refreshing.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => window.location.reload()} className="text-xs text-primary underline">
            Refresh
          </button>
          <span className="text-muted-foreground">·</span>
          <a href="/login" className="text-xs text-primary underline">
            Sign in again
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConditionalScreen state={state} />
      <DashboardChrome state={state} showSyncPulse={isFetching} />
    </>
  );
}

function DashboardChrome({
  state,
  showSyncPulse,
}: {
  state: DashboardState;
  showSyncPulse: boolean;
}) {
  const { user, signals, activeBlueprint, activeOrders, streakDays, tasksCompletedToday } = state;

  const cond =
    typeof state.conditionDetail?.condition === "string"
      ? state.conditionDetail.condition
      : signals?.condition;

  const flags = state.featureFlags ?? {};

  const showSignalsPanel = flags.signals_dashboard !== false;
  const showEnforcementPanel = flags.enforcement_panel !== false && state.enforcement;
  const showIdentityPeek = flags.identity_dashboard_peek !== false;

  const action = parseCurrentAction(state.currentAction ?? null);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {!state.health?.systemOperational && (
        <Alert variant="destructive" className="font-mono text-xs border-destructive/50">
          <AlertTitle className="text-sm">SYSTEM_CONSTRAINT</AlertTitle>
          <AlertDescription>{state.health?.message ?? "Execution safeguards active."}</AlertDescription>
        </Alert>
      )}

      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:justify-between sm:items-end">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">SYSTEM_OVERVIEW</h1>
            {showSyncPulse && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary/80" title="Refreshing projection" />
            )}
          </div>
          <p className="text-muted-foreground text-sm font-mono">
            Welcome back, {user?.displayName ?? user?.email ?? "Operator"}.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-6 sm:text-right">
          <div className="space-y-2">
            <ConditionBadge condition={cond} className="text-sm px-3 py-1" />
            <div className="text-xs text-muted-foreground font-mono mt-2">
              LAST COMPUTED: {signals?.computedAt ? new Date(signals.computedAt).toLocaleTimeString() : "N/A"}
            </div>
          </div>
          {typeof state.conditionDetail?.escalationLevel === "number" && (
            <div className="font-mono text-[10px] uppercase text-muted-foreground border border-border/60 rounded px-3 py-2 text-left">
              <div>Recovery required: {String(state.conditionDetail.recoveryRequired)}</div>
              <div>Escalation L{Number(state.conditionDetail.escalationLevel)}</div>
              <div>Duration ~{Number(state.conditionDetail.durationDays ?? 0)}d</div>
            </div>
          )}
        </div>
      </header>

      {showSignalsPanel && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="MOMENTUM" value={signals?.momentum ?? 0} icon={Zap} suffix="%" />
          <MetricCard title="CONSISTENCY" value={signals?.consistency ?? 0} icon={Target} suffix="%" />
          <MetricCard title="VELOCITY" value={signals?.velocity ?? 0} icon={Activity} suffix="/100" />
          <MetricCard title="STREAK" value={streakDays ?? 0} icon={Clock} suffix=" DAYS" />
        </div>
      )}

      {showSignalsPanel && state.signalProjection && (
        <Card className="border-border/70 bg-secondary/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Signal projection snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm font-mono">
            <ProjectionStat label="Completion rate" val={pct(state.signalProjection.completionRate)} />
            <ProjectionStat label="Weighted score" val={num(state.signalProjection.weightedScore)} />
            <ProjectionStat label="Trend" val={stringish(state.signalProjection.trend)} />
            <ProjectionStat label="Confidence" val={stringish(state.signalProjection.confidence)} />
            <ProjectionStat label="Blockers" val={nullablePct(state.signalProjection.blockerRatio)} />
            <ProjectionStat label="Skips" val={nullablePct(state.signalProjection.skipRatio)} />
          </CardContent>
        </Card>
      )}

      {showEnforcementPanel && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground">Enforcement view</CardTitle>
            <CardDescription className="text-xs">Rules / gates from blueprint state projection</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-48 overflow-auto rounded-md border border-border bg-card p-3 text-[11px] font-mono whitespace-pre-wrap">
              {pretty(state.enforcement)}
            </pre>
          </CardContent>
        </Card>
      )}

      {!showSignalsPanel && !showEnforcementPanel && (
        <p className="text-xs font-mono text-muted-foreground uppercase">Panels hidden by feature flags.</p>
      )}

      {showIdentityPeek && (
        <p className="text-[11px] font-mono uppercase text-muted-foreground">
          Identity recap: signals trend {state.signalProjection ? stringish(state.signalProjection.trend) : "live"} —
          see <Link href="/identity"><span className="text-primary hover:underline">Identity</span></Link>
        </p>
      )}

      <PrimaryActionBanner action={action} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-mono">ACTIVE_ORDERS</h2>
            <span className="text-xs font-mono text-muted-foreground">{activeOrders.length} QUEUED</span>
          </div>

          {activeOrders.length === 0 ? (
            <Card className="bg-secondary/20 border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground font-mono text-sm">
                NO ACTIVE ORDERS IN QUEUE
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <Card key={order.id} className="hover:border-primary/50 transition-colors bg-card group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">
                          {order.type.toUpperCase()}
                        </span>
                        {order.priority > 0 && (
                          <span className="text-xs font-mono text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> P{order.priority}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-lg">{order.title}</h3>
                      {order.estimatedMinutes ? (
                        <p className="text-xs text-muted-foreground font-mono">EST: {order.estimatedMinutes} MIN</p>
                      ) : null}
                    </div>
                    <Link href={`/tasks/${order.id}`}>
                      <Button variant="default" className="font-mono uppercase text-xs w-full sm:w-auto shadow-[0_0_15px_rgba(0,180,255,0.2)] hover:shadow-[0_0_20px_rgba(0,180,255,0.4)] transition-all">
                        <Play className="w-3 h-3 mr-2" /> EXECUTE
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-mono">ACTIVE_BLUEPRINT</h2>
          </div>

          {!activeBlueprint ? (
            <Card className="bg-secondary/20 border-dashed">
              <CardContent className="p-8 text-center space-y-4">
                <p className="text-muted-foreground font-mono text-sm">NO ACTIVE BLUEPRINT</p>
                <Link href="/onboarding">
                  <Button variant="outline" className="w-full font-mono text-xs">
                    INITIATE BLUEPRINT
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardDescription className="font-mono text-xs text-primary mb-1">
                  {activeBlueprint.domain?.toUpperCase() ?? "DOMAIN"}
                </CardDescription>
                <CardTitle className="text-lg leading-tight">{activeBlueprint.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>PHASE {activeBlueprint.phase}</span>
                  </div>
                  <Progress value={(activeBlueprint.phase / Math.max(activeBlueprint.totalPhases ?? 3, 1)) * 100} className="h-1.5" />
                </div>

                <Link href={`/blueprint/${activeBlueprint.id}`}>
                  <Button
                    variant="ghost"
                    className="w-full font-mono text-xs justify-between group border-primary/20 hover:border-primary/50 hover:bg-primary/10"
                  >
                    VIEW BLUEPRINT DETAILS <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground">TODAY&apos;S YIELD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {tasksCompletedToday ?? 0}{" "}
                <span className="text-lg text-muted-foreground font-sans font-normal">tasks</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PrimaryActionBanner({ action }: { action: ReturnType<typeof parseCurrentAction> }) {
  if (!action.orderId || !action.title) return null;

  const lines = [
    action.instruction,
    action.expectedOutput ? `OUTPUT: ${action.expectedOutput}` : null,
    action.definitionOfDone ? `DONE: ${action.definitionOfDone}` : null,
    action.whyItMatters ? `WHY: ${action.whyItMatters}` : null,
    action.difficulty ? `DIFFICULTY: ${action.difficulty}` : null,
  ].filter(Boolean);

  const proofHint =
    action.proofRequired && action.proofDescription
      ? `Proof (${action.proofType ?? "?"}): ${action.proofDescription}`
      : action.proofRequired
        ? "Proof required."
        : null;

  const estimate =
    typeof action.timeEstimateMinutes === "number" ? `${action.timeEstimateMinutes} min est.` : null;

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/15 to-transparent shadow-[0_0_35px_-12px_var(--primary)]">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardDescription className="font-mono text-[10px] uppercase text-primary/90 mb-2">
            PRIMARY_TASK · {action.taskType?.toUpperCase() ?? "TASK"}
          </CardDescription>
          <CardTitle className="text-xl">{action.title}</CardTitle>
        </div>
        <Link href={`/tasks/${action.orderId}`}>
          <Button className="font-mono uppercase text-xs shrink-0">
            <Play className="mr-2 h-3 w-3" /> Execute
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <ul className="list-disc space-y-2 pl-5">
          {lines.map((ln, i) => (
            <li key={i}>{ln}</li>
          ))}
        </ul>
        {proofHint && <p className="font-mono text-xs uppercase text-amber-500">{proofHint}</p>}
        {(estimate || action.priority > 0) && (
          <p className="font-mono text-[11px]">
            {[estimate, action.priority > 0 ? `P${action.priority}` : null].filter(Boolean).join(" · ")}
          </p>
        )}
        {(action.knowledgeObjects?.length ?? 0) > 0 && (
          <div className="rounded-md border border-border/70 bg-secondary/40 p-3">
            <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Knowledge</p>
            <ul className="space-y-1 font-mono text-xs">
              {action.knowledgeObjects!.slice(0, 3).map((k: { id: string; title?: string | null }) => (
                <li key={k.id}>{k.title ?? `Ref ${k.id.slice(0, 6)}`}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function parseCurrentAction(raw: Record<string, unknown> | null) {
  if (!raw) {
    return {
      orderId: "",
      title: "",
      instruction: "",
      expectedOutput: "",
      definitionOfDone: "",
      whyItMatters: null as string | null,
      difficulty: "",
      taskType: "",
      timeEstimateMinutes: null as number | null,
      proofRequired: false,
      proofType: null as string | null,
      proofDescription: null as string | null,
      priority: 0,
      knowledgeObjects: [] as Array<{ id: string; title?: string | null }>,
    };
  }
  const gid = typeof raw.orderId === "string" ? raw.orderId : typeof raw.id === "string" ? raw.id : "";
  return {
    orderId: gid,
    title: typeof raw.title === "string" ? raw.title : "",
    instruction: typeof raw.instruction === "string" ? raw.instruction : "",
    expectedOutput: typeof raw.expectedOutput === "string" ? raw.expectedOutput : "",
    definitionOfDone: typeof raw.definitionOfDone === "string" ? raw.definitionOfDone : "",
    whyItMatters: typeof raw.whyItMatters === "string" ? raw.whyItMatters : null,
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : "",
    taskType: typeof raw.taskType === "string" ? raw.taskType : "",
    timeEstimateMinutes: typeof raw.timeEstimateMinutes === "number" ? raw.timeEstimateMinutes : null,
    proofRequired: raw.proofRequired === true,
    proofType: typeof raw.proofType === "string" ? raw.proofType : null,
    proofDescription: typeof raw.proofDescription === "string" ? raw.proofDescription : null,
    priority: typeof raw.priority === "number" ? raw.priority : 0,
    knowledgeObjects: Array.isArray(raw.knowledgeObjects) ? raw.knowledgeObjects : [],
  };
}

function pretty(obj: unknown) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function pct(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : "—";
}

function num(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : "—";
}

function nullablePct(n: unknown) {
  return n === null || n === undefined ? "—" : pct(Number(n));
}

function stringish(n: unknown) {
  return typeof n === "string" && n.length ? n : "—";
}

function ProjectionStat({ label, val }: { label: string; val: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase opacity-70">{label}</div>
      <div className="text-sm font-semibold text-foreground">{val}</div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  suffix,
}: {
  title: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  suffix: string;
}) {
  return (
    <Card className="bg-card">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="text-xs font-mono font-bold text-muted-foreground uppercase">{title}</div>
          <Icon className="w-4 h-4 text-primary/60" />
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
          {value}
          <span className="text-lg text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}
