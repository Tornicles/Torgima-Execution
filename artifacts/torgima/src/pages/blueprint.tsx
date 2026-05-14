import { useGetBlueprint, useGetBlueprintState, usePauseBlueprint, useResumeBlueprint } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConditionBadge } from "@/components/ConditionBadge";
import { Play, Pause, AlertTriangle, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function BlueprintPage() {
  const { id } = useParams();
  const { data: blueprint, isLoading: bpLoading } = useGetBlueprint(id!);
  const { data: state, isLoading: stateLoading, refetch } = useGetBlueprintState(id!);

  const pauseMutation = usePauseBlueprint();
  const resumeMutation = useResumeBlueprint();

  const [pauseReason, setPauseReason] = useState("");
  const [isPauseOpen, setIsPauseOpen] = useState(false);

  if (bpLoading || stateLoading) return <div className="p-8"><Skeleton className="h-64" /></div>;
  if (!blueprint || !state) return <div className="p-8 font-mono">Blueprint not found.</div>;

  const handlePause = () => {
    pauseMutation.mutate({ id: id!, data: { reason: pauseReason } }, {
      onSuccess: () => {
        setIsPauseOpen(false);
        refetch();
      }
    });
  };

  const handleResume = () => {
    resumeMutation.mutate({ id: id! }, {
      onSuccess: () => refetch()
    });
  };

  const isActive = blueprint.status === "active";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 text-muted-foreground font-mono text-sm mb-4">
        <Link href="/dashboard"><span className="hover:text-primary cursor-pointer transition-colors flex items-center"><ArrowLeft className="w-3 h-3 mr-1" /> BACK TO DASHBOARD</span></Link>
      </div>

      <header className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 uppercase">{blueprint.domain}</Badge>
              <Badge variant={isActive ? "default" : "secondary"} className="font-mono text-xs uppercase">{blueprint.status}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{blueprint.title}</h1>
          </div>
          <div>
            {isActive ? (
              <Dialog open={isPauseOpen} onOpenChange={setIsPauseOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 font-mono text-xs">
                    <Pause className="w-3 h-3 mr-2" /> PAUSE EXECUTION
                  </Button>
                </DialogTrigger>
                <DialogContent className="font-mono">
                  <DialogHeader>
                    <DialogTitle>HALT EXECUTION</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">State your reason for halting this blueprint. This will be recorded and analyzed.</p>
                    <Textarea
                      placeholder="Reason for pause..."
                      value={pauseReason}
                      onChange={e => setPauseReason(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">CANCEL</Button></DialogClose>
                    <Button variant="destructive" onClick={handlePause} disabled={!pauseReason.trim() || pauseMutation.isPending}>
                      CONFIRM PAUSE
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : blueprint.status === "paused" ? (
              <Button variant="default" onClick={handleResume} disabled={resumeMutation.isPending} className="font-mono text-xs shadow-[0_0_15px_rgba(0,180,255,0.3)]">
                <Play className="w-3 h-3 mr-2" /> RESUME EXECUTION
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="border-b border-border/50 bg-secondary/10">
            <CardTitle className="font-mono text-sm">PHASE STATUS</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2 font-mono">
                <span className="font-bold text-lg">Phase {blueprint.phase} <span className="text-muted-foreground text-sm font-normal">of {blueprint.totalPhases || '?'}</span></span>
                <span className="text-primary font-bold">{state.phaseProgress}%</span>
              </div>
              <Progress value={state.phaseProgress} className="h-2" />
            </div>

            {blueprint.status === "paused" && blueprint.pausedReason && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded space-y-1">
                <div className="flex items-center gap-2 text-amber-500 font-mono text-sm font-bold">
                  <AlertTriangle className="w-4 h-4" /> EXECUTION HALTED
                </div>
                <p className="text-sm font-mono text-amber-500/80 pl-6">Reason: {blueprint.pausedReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/50 bg-secondary/10">
            <CardTitle className="font-mono text-sm">CONDITION</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4 h-full">
              <ConditionBadge condition={state.condition || blueprint.currentCondition} className="text-base px-4 py-1.5" />
              <p className="text-xs text-muted-foreground font-mono text-center">
                System is continuously monitoring momentum, consistency, and velocity to enforce execution.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold font-mono border-b border-border pb-2">ACTIVE ORDERS</h2>
        {state.activeOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-mono bg-secondary/10 border border-dashed rounded">
            NO ORDERS PENDING FOR THIS BLUEPRINT
          </div>
        ) : (
          <div className="grid gap-3">
            {state.activeOrders.map(order => (
              <div key={order.id} className="p-4 bg-card border border-border rounded flex items-center justify-between hover:border-primary/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold text-primary px-1.5 bg-primary/10 rounded uppercase">{order.type}</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{order.status}</span>
                  </div>
                  <h3 className="font-bold">{order.title}</h3>
                </div>
                <Link href={`/task/${order.id}`}>
                  <Button variant="secondary" size="sm" className="font-mono text-xs">OPEN</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
