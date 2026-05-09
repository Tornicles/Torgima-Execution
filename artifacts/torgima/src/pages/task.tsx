import { useGetOrder, useStartOrder, useFinishOrder, useBlockOrder, useSubmitTaskFeedback } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Check, ShieldAlert, Timer } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function TaskPage() {
  const { id } = useParams();
  const [_, setLocation] = useLocation();
  const { data: orderRes, isLoading, refetch } = useGetOrder(id!);
  const order = orderRes?.data;

  const startMutation = useStartOrder();
  const blockMutation = useBlockOrder();
  const feedbackMutation = useSubmitTaskFeedback();
  
  const [blockReason, setBlockReason] = useState("");
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  
  const [completionRating, setCompletionRating] = useState<number>(5);
  const [effortRating, setEffortRating] = useState<number>(3);
  const [notes, setNotes] = useState("");

  if (isLoading) return <div className="p-8"><Skeleton className="h-64" /></div>;
  if (!order) return <div className="p-8 font-mono">Order not found.</div>;

  const handleStart = () => {
    startMutation.mutate({ params: { id: id! }, data: {} }, {
      onSuccess: () => refetch()
    });
  };

  const handleBlock = () => {
    blockMutation.mutate({ params: { id: id! }, data: { reason: blockReason } }, {
      onSuccess: () => {
        setIsBlockOpen(false);
        refetch();
      }
    });
  };

  const handleComplete = () => {
    setIsFeedbackOpen(true);
  };

  const submitFeedback = () => {
    feedbackMutation.mutate({
      data: {
        orderId: id!,
        completionRating,
        effortRating,
        notes
      }
    }, {
      onSuccess: () => {
        setIsFeedbackOpen(false);
        setLocation(`/blueprint/${order.blueprintId}`);
      }
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Link href={`/blueprint/${order.blueprintId}`}>
        <span className="text-muted-foreground font-mono text-sm hover:text-primary cursor-pointer transition-colors flex items-center w-fit mb-6"><ArrowLeft className="w-3 h-3 mr-1" /> BACK TO BLUEPRINT</span>
      </Link>

      <Card className="border-t-4 border-t-primary shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">{order.type}</Badge>
            <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/30 text-primary">{order.status.replace('_', ' ')}</Badge>
            {order.estimatedMinutes && (
              <span className="flex items-center text-xs font-mono text-muted-foreground ml-auto">
                <Timer className="w-3 h-3 mr-1" /> {order.estimatedMinutes} MIN
              </span>
            )}
          </div>
          <CardTitle className="text-2xl sm:text-3xl leading-tight">{order.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          {order.description && (
            <div className="text-muted-foreground leading-relaxed">
              {order.description}
            </div>
          )}

          {order.instructions && (
            <div className="p-4 bg-secondary/30 rounded border border-border/50">
              <h4 className="font-mono font-bold text-xs mb-2 text-primary">EXECUTION PARAMETERS</h4>
              <p className="whitespace-pre-wrap font-mono text-sm">{order.instructions}</p>
            </div>
          )}
          
          {order.status === "blocked" && order.blockedReason && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded text-destructive font-mono text-sm">
              <span className="font-bold block mb-1">BLOCKED:</span>
              {order.blockedReason}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-border/50 pt-6 flex flex-wrap gap-3 justify-between bg-secondary/10">
          {order.status === "queued" || order.status === "paused" ? (
            <Button onClick={handleStart} disabled={startMutation.isPending} className="font-mono font-bold tracking-wider px-8 shadow-[0_0_15px_rgba(0,180,255,0.2)]">
              <Play className="w-4 h-4 mr-2" /> INITIATE
            </Button>
          ) : order.status === "in_progress" ? (
            <>
              <Button variant="default" onClick={handleComplete} className="font-mono font-bold tracking-wider px-8 bg-green-600 hover:bg-green-700 text-white">
                <Check className="w-4 h-4 mr-2" /> MARK COMPLETE
              </Button>
              
              <Dialog open={isBlockOpen} onOpenChange={setIsBlockOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10 font-mono">
                    <ShieldAlert className="w-4 h-4 mr-2" /> REPORT BLOCKER
                  </Button>
                </DialogTrigger>
                <DialogContent className="font-mono">
                  <DialogHeader><DialogTitle>REPORT IMPEDIMENT</DialogTitle></DialogHeader>
                  <div className="py-4 space-y-4">
                    <Textarea 
                      placeholder="Describe what is preventing execution..."
                      value={blockReason}
                      onChange={e => setBlockReason(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">CANCEL</Button></DialogClose>
                    <Button variant="destructive" onClick={handleBlock} disabled={!blockReason.trim() || blockMutation.isPending}>SUBMIT BLOCKER</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="text-muted-foreground font-mono text-sm uppercase flex items-center">
              <Check className="w-4 h-4 mr-2 text-green-500" /> ORDER CONCLUDED
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Completion Feedback Dialog */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="font-mono max-w-lg">
          <DialogHeader>
            <DialogTitle>AFTER ACTION REPORT</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground block">COMPLETION QUALITY (1-5)</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(v => (
                  <button 
                    key={v}
                    onClick={() => setCompletionRating(v)}
                    className={`w-10 h-10 rounded font-bold border transition-colors ${completionRating === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground block">EFFORT EXPENDED (1-5)</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(v => (
                  <button 
                    key={v}
                    onClick={() => setEffortRating(v)}
                    className={`w-10 h-10 rounded font-bold border transition-colors ${effortRating === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border hover:border-primary/50'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground block">EXECUTION NOTES</label>
              <Textarea 
                placeholder="Deviations? Discoveries?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="bg-background font-sans"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">CANCEL</Button></DialogClose>
            <Button onClick={submitFeedback} disabled={feedbackMutation.isPending} className="bg-primary">
              SUBMIT & CONCLUDE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
