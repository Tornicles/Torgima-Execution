import { useState, useId } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TerminalSquare, Loader2, AlertCircle, CheckCircle2, ChevronRight, ArrowLeft } from "lucide-react";
import {
  useSubmitOnboardingGoal,
  useActivateBlueprint,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import type {
  OnboardingGoalResult,
  ValidationPath,
} from "@workspace/api-client-react";

// ── TYPES ─────────────────────────────────────────────────────────────────────

type Step = "goal_entry" | "validation_result" | "path_selection" | "activating";

// ── HELPERS ───────────────────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  const colour = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-amber-400" : "text-red-500 bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted-foreground">{label}</span>
        <span className={score >= 70 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400"}>{score}/100</span>
      </div>
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "proceed") {
    return <span className="text-xs font-mono font-bold text-green-400 border border-green-400/40 rounded px-2 py-0.5">PROCEED</span>;
  }
  if (verdict === "adjust") {
    return <span className="text-xs font-mono font-bold text-amber-400 border border-amber-400/40 rounded px-2 py-0.5">ADJUST</span>;
  }
  return <span className="text-xs font-mono font-bold text-red-400 border border-red-400/40 rounded px-2 py-0.5">PIVOT REQUIRED</span>;
}

function PathCard({
  path,
  selected,
  onSelect,
}: {
  path: ValidationPath;
  selected: boolean;
  onSelect: () => void;
}) {
  const riskColour = {
    low:    "text-green-400 border-green-400/30",
    medium: "text-amber-400 border-amber-400/30",
    high:   "text-red-400 border-red-400/30",
  }[path.riskLevel ?? "medium"] ?? "text-muted-foreground border-border";

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded border transition-all space-y-3 ${
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]"
          : "border-border hover:border-primary/50 bg-card/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              {path.type}
            </span>
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${riskColour}`}>
              {path.riskLevel?.toUpperCase()} RISK
            </span>
          </div>
          <p className="font-bold font-mono text-sm">{path.title}</p>
        </div>
        {selected && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-1" />}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{path.summary}</p>

      <div className="text-xs text-muted-foreground">
        <span className="text-primary/70 font-mono">EXPECTED:</span>{" "}
        {path.expectedOutcome}
      </div>

      {path.keyChanges && (
        <div className="text-xs text-muted-foreground">
          <span className="text-primary/70 font-mono">CHANGES:</span>{" "}
          {path.keyChanges}
        </div>
      )}
    </button>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const idempotencyKey = useId();

  const [step, setStep] = useState<Step>("goal_entry");
  const [rawGoal, setRawGoal] = useState("");
  const [purpose, setPurpose] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentContext, setCurrentContext] = useState("");
  const [successSignal, setSuccessSignal] = useState("");

  const [onboardingResult, setOnboardingResult] = useState<OnboardingGoalResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<"current" | "adjusted" | "alternative" | null>(null);

  const submitGoal   = useSubmitOnboardingGoal();
  const activateBp   = useActivateBlueprint();

  const stepNum = { goal_entry: 1, validation_result: 2, path_selection: 3, activating: 4 }[step];

  // ── STEP 1: submit goal ──────────────────────────────────────────────────

  const handleSubmitGoal = () => {
    if (!rawGoal.trim()) return;
    submitGoal.mutate(
      {
        data: {
          rawGoal,
          purpose:        purpose || undefined,
          timeframe:      timeframe || undefined,
          currentContext: currentContext || undefined,
          successSignal:  successSignal || undefined,
          idempotencyKey: `onboarding_${idempotencyKey}`,
        },
      },
      {
        onSuccess: (res) => {
          const r = res as unknown as OnboardingGoalResult;
          setOnboardingResult(r);

          if (r.status === "invalid" || r.status === "needs_clarification") {
            toast({
              title:       r.status === "invalid" ? "Goal needs more detail" : "A few things are missing",
              description: r.missingFields?.join(", ") ?? "Add more context to proceed.",
              variant:     "destructive",
            });
            return;
          }

          setStep("validation_result");
        },
        onError: () => {
          toast({ title: "Could not process goal", variant: "destructive" });
        },
      },
    );
  };

  // ── STEP 2 → 3: advance to path selection ───────────────────────────────

  const handleProceedToPathSelection = () => {
    setStep("path_selection");
  };

  // ── STEP 3 → activate ────────────────────────────────────────────────────

  const handleActivate = () => {
    const blueprintId = onboardingResult?.blueprintId;
    if (!blueprintId) return;

    setStep("activating");

    activateBp.mutate(
      {
        id:   blueprintId,
        data: { selectedPath: selectedPath ?? undefined },
      },
      {
        onSuccess: () => {
          toast({ title: "Blueprint activated" });
          setLocation(`/blueprint/${blueprintId}`);
        },
        onError: () => {
          setStep("path_selection");
          toast({ title: "Activation failed — please try again", variant: "destructive" });
        },
      },
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  const paths = onboardingResult?.paths;
  const scores = onboardingResult?.scores;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 animate-in fade-in zoom-in duration-700">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
            <TerminalSquare className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">INITIALIZE SYSTEM</h1>
          <div className="w-full max-w-md mx-auto">
            <Progress value={(stepNum / 4) * 100} className="h-1 bg-secondary" />
          </div>
          <p className="text-xs font-mono text-muted-foreground">STEP {stepNum} OF 4</p>
        </div>

        <Card className="border-primary/20 shadow-2xl bg-card/80 backdrop-blur-xl">
          <CardContent className="p-8">

            {/* ── STEP 1: Goal Entry ─────────────────────────────────────── */}
            {step === "goal_entry" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold font-mono">STATE YOUR OBJECTIVE</h2>
                  <p className="text-sm text-muted-foreground">Be raw. Be honest. What are you trying to accomplish?</p>
                </div>

                <Textarea
                  value={rawGoal}
                  onChange={(e) => setRawGoal(e.target.value)}
                  placeholder="e.g., I want to build a SaaS app and reach $10k MRR in 6 months..."
                  className="min-h-[120px] font-mono text-sm bg-background border-border resize-none focus-visible:ring-primary/50"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono text-muted-foreground">WHY THIS GOAL?</Label>
                    <Input
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="To become financially free"
                      className="font-mono text-sm bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono text-muted-foreground">TIMEFRAME</Label>
                    <Input
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      placeholder="e.g., 6 months"
                      className="font-mono text-sm bg-background"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs font-mono text-primary/60 hover:text-primary flex items-center gap-1"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
                  {showAdvanced ? "HIDE" : "ADD"} CONTEXT (optional)
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-1 gap-4 border-t border-border pt-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-mono text-muted-foreground">CURRENT SITUATION</Label>
                      <Input
                        value={currentContext}
                        onChange={(e) => setCurrentContext(e.target.value)}
                        placeholder="e.g., Currently at $0 MRR, product is live with 50 users"
                        className="font-mono text-sm bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-mono text-muted-foreground">SUCCESS SIGNAL</Label>
                      <Input
                        value={successSignal}
                        onChange={(e) => setSuccessSignal(e.target.value)}
                        placeholder="e.g., Quit my job and work on this full-time"
                        className="font-mono text-sm bg-background"
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSubmitGoal}
                  disabled={!rawGoal.trim() || submitGoal.isPending}
                  className="w-full font-mono font-bold tracking-widest"
                >
                  {submitGoal.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  ANALYZE INTENT
                </Button>
              </div>
            )}

            {/* ── STEP 2: Validation Result ─────────────────────────────── */}
            {step === "validation_result" && onboardingResult && scores && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold font-mono">SYSTEM ANALYSIS</h2>
                    <p className="text-sm text-muted-foreground">Bhudhi has evaluated your goal.</p>
                  </div>
                  <VerdictBadge verdict={onboardingResult.verdict ?? "adjust"} />
                </div>

                <div className="p-4 bg-secondary/50 rounded border border-border space-y-3">
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">SCORES</div>
                  <ScoreBar label="CLARITY"     score={scores.clarity?.score     ?? 0} />
                  <ScoreBar label="FEASIBILITY" score={scores.feasibility?.score ?? 0} />
                  <ScoreBar label="REALISM"     score={scores.realism?.score     ?? 0} />
                  <ScoreBar label="USEFULNESS"  score={scores.usefulness?.score  ?? 0} />
                  <div className="pt-2 border-t border-border">
                    <ScoreBar label="OVERALL" score={scores.overall ?? 0} />
                  </div>
                </div>

                {onboardingResult.verdict === "pivot" && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex gap-2 text-destructive/80 text-xs font-mono">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Your goal needs significant restructuring. Three alternative paths have been generated below.
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("goal_entry")} className="font-mono w-1/3">
                    <ArrowLeft className="w-3 h-3 mr-1" /> REVISE
                  </Button>
                  <Button onClick={handleProceedToPathSelection} className="font-mono font-bold w-2/3">
                    CHOOSE EXECUTION PATH <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Path Selection ────────────────────────────────── */}
            {step === "path_selection" && paths && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold font-mono">CHOOSE YOUR PATH</h2>
                  <p className="text-sm text-muted-foreground">Select how you want Torgima to structure your execution.</p>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {(["current", "adjusted", "alternative"] as const).map((type) => {
                    const path = paths[type] as ValidationPath | undefined;
                    if (!path) return null;
                    return (
                      <PathCard
                        key={type}
                        path={path}
                        selected={selectedPath === type}
                        onSelect={() => setSelectedPath(type)}
                      />
                    );
                  })}
                </div>

                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded">
                  <div className="flex gap-2 text-destructive font-mono text-sm font-bold mb-2">
                    <AlertCircle className="w-4 h-4" /> WARNING
                  </div>
                  <p className="text-xs text-destructive/80 font-mono">
                    Activating this blueprint hands execution authority to Torgima. You will be held to the standard required to achieve this goal.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("validation_result")} className="font-mono w-1/3">
                    <ArrowLeft className="w-3 h-3 mr-1" /> BACK
                  </Button>
                  <Button
                    onClick={handleActivate}
                    disabled={!selectedPath}
                    className="font-mono font-bold w-2/3 tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 h-12"
                  >
                    ACKNOWLEDGE AND ACTIVATE
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Activating ───────────────────────────────────── */}
            {step === "activating" && (
              <div className="space-y-6 text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <div className="space-y-2">
                  <h2 className="text-xl font-bold font-mono">ACTIVATING BLUEPRINT</h2>
                  <p className="text-sm text-muted-foreground font-mono">Building your execution chain...</p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
