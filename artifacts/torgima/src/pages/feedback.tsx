import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function FeedbackPage() {
  // Currently a stub for weekly review submission
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-primary" /> SYSTEM_FEEDBACK
        </h1>
        <p className="text-muted-foreground font-mono text-sm">Process reviews and system interrogations.</p>
      </header>

      <Card className="border-primary/20 bg-secondary/5">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold mb-2">
            <AlertCircle className="w-4 h-4" /> CYCLE PENDING
          </div>
          <CardTitle className="font-mono">WEEKLY REVIEW SUBMISSION</CardTitle>
          <CardDescription className="font-mono text-xs">Required to maintain system velocity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold font-mono text-muted-foreground">OVERALL RATING (1-10)</label>
            <div className="flex gap-2">
              {[...Array(10)].map((_, i) => (
                <button key={i} className="w-8 h-8 rounded border border-border bg-background hover:border-primary/50 font-mono text-xs font-bold transition-colors">
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold font-mono text-muted-foreground">WINS</label>
            <Textarea className="bg-background font-sans" placeholder="What went well this cycle?" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold font-mono text-muted-foreground">CHALLENGES</label>
            <Textarea className="bg-background font-sans border-amber-500/30 focus-visible:ring-amber-500" placeholder="What blocked execution?" />
          </div>
          <Button className="w-full font-mono font-bold tracking-widest mt-4">SUBMIT REVIEW</Button>
        </CardContent>
      </Card>
    </div>
  );
}
