import { useGetCurrentSignals, useGetSignalHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConditionBadge } from "@/components/ConditionBadge";
import { Progress } from "@/components/ui/progress";
import { Activity, Gauge, TrendingUp, BarChart3 } from "lucide-react";

export default function SignalsPage() {
  const { data: signalsRes, isLoading } = useGetCurrentSignals();
  const { data: historyRes } = useGetSignalHistory();
  
  const signals = signalsRes?.data;
  const history = historyRes?.data || [];

  if (isLoading) {
    return <div className="p-8"><Skeleton className="h-[400px]" /></div>;
  }

  if (!signals) return <div className="p-8">No signal data available.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in">
      <header className="space-y-2 mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" /> SIGNAL_TELEMETRY
        </h1>
        <p className="text-muted-foreground font-mono text-sm">System intelligence and performance metrics.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-3">
          <Card className="border-primary/20 bg-secondary/10">
            <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-2 text-center md:text-left">
                <h2 className="text-sm font-mono text-muted-foreground font-bold">CURRENT DIRECTIVE CONDITION</h2>
                <ConditionBadge condition={signals.condition} className="text-xl px-4 py-2" />
              </div>
              <div className="grid grid-cols-3 gap-8 w-full md:w-auto">
                <div className="space-y-2 text-center">
                  <div className="text-4xl font-bold font-mono tracking-tighter">{signals.momentum}%</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-widest">Momentum</div>
                </div>
                <div className="space-y-2 text-center border-l border-border pl-8">
                  <div className="text-4xl font-bold font-mono tracking-tighter">{signals.consistency}%</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-widest">Consistency</div>
                </div>
                <div className="space-y-2 text-center border-l border-border pl-8">
                  <div className="text-4xl font-bold font-mono tracking-tighter">{signals.velocity}%</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-widest">Velocity</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" /> MOMENTUM DRIVERS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono"><span>Task Completion Rate</span> <span className="font-bold">High</span></div>
              <Progress value={85} className="h-1" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono"><span>Action Latency</span> <span className="font-bold text-amber-500">Medium</span></div>
              <Progress value={50} className="h-1 [&>div]:bg-amber-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono"><span>Feedback Quality</span> <span className="font-bold text-primary">High</span></div>
              <Progress value={90} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> SIGNAL HISTORY (LAST 7 DAYS)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">NOT ENOUGH DATA GATHERED</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono text-left">
                  <thead className="bg-secondary/20">
                    <tr>
                      <th className="p-3 font-bold text-muted-foreground">DATE</th>
                      <th className="p-3 font-bold text-muted-foreground text-right">MOMENTUM</th>
                      <th className="p-3 font-bold text-muted-foreground text-right">CONSISTENCY</th>
                      <th className="p-3 font-bold text-muted-foreground">CONDITION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {history.map((snap) => (
                      <tr key={snap.id} className="hover:bg-secondary/10">
                        <td className="p-3">{new Date(snap.snapshotDate).toLocaleDateString()}</td>
                        <td className="p-3 text-right">{snap.momentum}%</td>
                        <td className="p-3 text-right">{snap.consistency}%</td>
                        <td className="p-3"><ConditionBadge condition={snap.condition} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
