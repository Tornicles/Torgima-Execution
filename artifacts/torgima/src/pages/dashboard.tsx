import { useGetDashboardState } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Target, Zap, Clock, AlertTriangle, ArrowRight, Play } from "lucide-react";
import { Link } from "wouter";
import { ConditionBadge } from "@/components/ConditionBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: state, isLoading } = useGetDashboardState();

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
    return <div className="p-8">Failed to load dashboard.</div>;
  }

  const { user, signals, activeBlueprint, activeOrders, streakDays, tasksCompletedToday } = state;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end border-b border-border pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">SYSTEM_OVERVIEW</h1>
          <p className="text-muted-foreground text-sm font-mono">Welcome back, {user?.displayName ?? user?.email ?? "Operator"}.</p>
        </div>
        <div className="text-right">
          <ConditionBadge condition={signals?.condition} className="text-sm px-3 py-1" />
          <div className="text-xs text-muted-foreground font-mono mt-2">LAST COMPUTED: {signals?.computedAt ? new Date(signals.computedAt).toLocaleTimeString() : 'N/A'}</div>
        </div>
      </header>

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="MOMENTUM" value={signals?.momentum ?? 0} icon={Zap} suffix="%" />
        <MetricCard title="CONSISTENCY" value={signals?.consistency ?? 0} icon={Target} suffix="%" />
        <MetricCard title="VELOCITY" value={signals?.velocity ?? 0} icon={Activity} suffix="/100" />
        <MetricCard title="STREAK" value={streakDays ?? 0} icon={Clock} suffix=" DAYS" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Orders */}
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
              {activeOrders.map(order => (
                <Card key={order.id} className="hover:border-primary/50 transition-colors bg-card group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">{order.type.toUpperCase()}</span>
                        {order.priority > 0 && <span className="text-xs font-mono text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> P{order.priority}</span>}
                      </div>
                      <h3 className="font-bold text-lg">{order.title}</h3>
                      {order.estimatedMinutes && (
                        <p className="text-xs text-muted-foreground font-mono">EST: {order.estimatedMinutes} MIN</p>
                      )}
                    </div>
                    <Link href={`/task/${order.id}`}>
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

        {/* Current Blueprint */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-mono">ACTIVE_BLUEPRINT</h2>
          </div>
          
          {!activeBlueprint ? (
            <Card className="bg-secondary/20 border-dashed">
              <CardContent className="p-8 text-center space-y-4">
                <p className="text-muted-foreground font-mono text-sm">NO ACTIVE BLUEPRINT</p>
                <Link href="/onboarding">
                  <Button variant="outline" className="w-full font-mono text-xs">INITIATE BLUEPRINT</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardDescription className="font-mono text-xs text-primary mb-1">{(activeBlueprint as any).domain?.toUpperCase() || 'DOMAIN'}</CardDescription>
                <CardTitle className="text-lg leading-tight">{(activeBlueprint as any).title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>PHASE {(activeBlueprint as any).phase}</span>
                    <span>{(activeBlueprint as any).phaseProgress ?? 0}%</span>
                  </div>
                  <Progress value={(activeBlueprint as any).phaseProgress ?? 0} className="h-1.5" />
                </div>
                
                <Link href={`/blueprint/${(activeBlueprint as any).id}`}>
                  <Button variant="ghost" className="w-full font-mono text-xs justify-between group border-primary/20 hover:border-primary/50 hover:bg-primary/10">
                    VIEW BLUEPRINT DETAILS <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground">TODAY'S YIELD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{tasksCompletedToday ?? 0} <span className="text-lg text-muted-foreground font-sans font-normal">tasks</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, suffix }: { title: string, value: number, icon: any, suffix: string }) {
  return (
    <Card className="bg-card">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="text-xs font-mono font-bold text-muted-foreground uppercase">{title}</div>
          <Icon className="w-4 h-4 text-primary/60" />
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
          {value}<span className="text-lg text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}
