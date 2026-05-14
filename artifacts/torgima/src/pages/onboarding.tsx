import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api-base";

type Step = "goal" | "context" | "validating" | "paths" | "launching";
type CommitmentLevel = "low" | "medium" | "high" | "full";
type PathType = "current" | "adjusted" | "alternative";

interface GoalInput {
  rawGoal: string;
  purpose: string;
  timeframe: string;
  commitmentLevel: CommitmentLevel;
  currentContext: string;
  successSignal: string;
  knownBlockers: string;
}

interface PathData {
  title: string;
  summary: string;
  riskLevel: string;
}

interface ValidationResult {
  blueprintId: string;
  verdict: string;
  scores: Record<string, { score: number; finding: string }>;
  paths: Record<string, PathData>;
  canProceed: boolean;
}

type GoalApiPayload = {
  status?: string;
  blueprintId?: string;
  verdict?: string;
  scores?: Record<string, { score: number; finding?: string }>;
  paths?: Record<string, PathData>;
  canProceed?: boolean;
  missingFields?: unknown;
};

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("goal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathType>("current");
  const [, setLocation] = useLocation();

  const [input, setInput] = useState<GoalInput>({
    rawGoal: "",
    purpose: "",
    timeframe: "",
    commitmentLevel: "medium",
    currentContext: "",
    successSignal: "",
    knownBlockers: "",
  });

  function update<K extends keyof GoalInput>(field: K, value: GoalInput[K]) {
    setInput((p) => ({ ...p, [field]: value }));
  }

  async function handleValidate() {
    if (!API_BASE_URL) {
      setError("API URL is not configured. Set VITE_API_BASE_URL on Vercel.");
      return;
    }
    setLoading(true);
    setError("");
    setStep("validating");

    try {
      const res = await fetch(`${API_BASE_URL}/api/onboarding/goal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          idempotencyKey: `onboarding-${Date.now()}`,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; data?: GoalApiPayload; error?: { message?: string } };

      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? "Validation failed. Please try again.");
        setStep("context");
        return;
      }

      const d = data.data;
      if (!d) {
        setError("Unexpected response from server.");
        setStep("context");
        return;
      }
      if (d.status === "invalid") {
        setError("Goal could not be validated. Refine your goal and try again.");
        setStep("context");
        return;
      }
      if (d.status === "needs_clarification") {
        setError("More detail is required before validation can continue.");
        setStep("context");
        return;
      }
      if (d.status !== "validated" || !d.paths || !d.blueprintId) {
        setError("Validation did not return execution paths.");
        setStep("context");
        return;
      }

      setValidation({
        blueprintId: d.blueprintId,
        verdict: d.verdict ?? "adjust",
        scores: (d.scores ?? {}) as ValidationResult["scores"],
        paths: d.paths,
        canProceed: d.canProceed !== false,
      });
      setStep("paths");
    } catch {
      setError("Cannot connect to the server.");
      setStep("context");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!validation?.blueprintId) return;
    if (!API_BASE_URL) return;
    setLoading(true);
    setError("");
    setStep("launching");

    try {
      const activateRes = await fetch(`${API_BASE_URL}/api/blueprints/${validation.blueprintId}/activate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedPath }),
      });

      const activateData = (await activateRes.json()) as { ok?: boolean; error?: { message?: string } };

      if (!activateRes.ok || !activateData.ok) {
        setError(activateData.error?.message ?? "Failed to launch blueprint.");
        setStep("paths");
        setLoading(false);
        return;
      }

      await fetch(`${API_BASE_URL}/api/onboarding/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      setLocation("/dashboard");
    } catch {
      setError("Cannot connect to the server.");
      setStep("paths");
    } finally {
      setLoading(false);
    }
  }

  const verdictColor = (v: string) =>
    v === "proceed" ? "text-green-400" : v === "adjust" ? "text-yellow-400" : "text-orange-400";

  const riskColor = (r: string) =>
    r === "low" ? "text-green-400" : r === "medium" ? "text-yellow-400" : "text-red-400";

  const stepLabel = {
    goal: "Step 1 of 3 — Define Your Goal",
    context: "Step 2 of 3 — Set The Context",
    validating: "Step 3 of 3 — Analysing...",
    paths: "Step 3 of 3 — Choose Your Path",
    launching: "Launching Blueprint...",
  }[step];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono font-bold text-lg">TORGIMA_OS</span>
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{stepLabel}</p>
        </div>

        <div className="flex gap-2">
          {["goal", "context", "paths"].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                (step === "goal" && i === 0) ||
                (step === "context" && i <= 1) ||
                ((step === "validating" || step === "paths" || step === "launching") && i <= 2)
                  ? "bg-primary"
                  : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          {step === "goal" && (
            <div className="space-y-5">
              <FieldGroup label="What is your goal?" required>
                <textarea
                  value={input.rawGoal}
                  onChange={(e) => update("rawGoal", e.target.value)}
                  placeholder="Be specific. What exactly will be different when this goal is achieved?"
                  rows={3}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                />
              </FieldGroup>

              <FieldGroup label="Why does this matter?" required>
                <textarea
                  value={input.purpose}
                  onChange={(e) => update("purpose", e.target.value)}
                  placeholder="What changes in your life or work when this is complete?"
                  rows={2}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                />
              </FieldGroup>

              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Timeframe" required>
                  <Input
                    value={input.timeframe}
                    onChange={(e) => update("timeframe", e.target.value)}
                    placeholder="e.g. 90 days"
                  />
                </FieldGroup>

                <FieldGroup label="Commitment" required>
                  <select
                    value={input.commitmentLevel}
                    onChange={(e) => update("commitmentLevel", e.target.value as CommitmentLevel)}
                    className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="low">Low — a few hours/week</option>
                    <option value="medium">Medium — daily work</option>
                    <option value="high">High — primary focus</option>
                    <option value="full">Full — all in</option>
                  </select>
                </FieldGroup>
              </div>

              <Button
                onClick={() => setStep("context")}
                disabled={!input.rawGoal.trim() || !input.purpose.trim() || !input.timeframe.trim()}
                className="w-full font-mono uppercase tracking-wider text-xs"
                size="lg"
              >
                Continue →
              </Button>
            </div>
          )}

          {step === "context" && (
            <div className="space-y-5">
              <FieldGroup label="Current situation">
                <textarea
                  value={input.currentContext}
                  onChange={(e) => update("currentContext", e.target.value)}
                  placeholder="What is your starting point? What resources or knowledge do you already have?"
                  rows={2}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                />
              </FieldGroup>

              <FieldGroup label="What does success look like?">
                <Input
                  value={input.successSignal}
                  onChange={(e) => update("successSignal", e.target.value)}
                  placeholder="How will you know when this goal is achieved?"
                />
              </FieldGroup>

              <FieldGroup label="Known blockers (optional)">
                <Input
                  value={input.knownBlockers}
                  onChange={(e) => update("knownBlockers", e.target.value)}
                  placeholder="What might slow you down?"
                />
              </FieldGroup>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                  <p className="text-destructive text-sm font-mono">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("goal")} className="flex-1 font-mono text-xs uppercase">
                  ← Back
                </Button>
                <Button
                  onClick={handleValidate}
                  disabled={loading}
                  className="flex-[2] font-mono uppercase tracking-wider text-xs"
                  size="lg"
                >
                  Validate Goal →
                </Button>
              </div>
            </div>
          )}

          {step === "validating" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="font-mono text-muted-foreground text-sm">Analysing your goal...</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Running validation against clarity, feasibility, realism, and usefulness dimensions.
              </p>
            </div>
          )}

          {step === "paths" && validation && (
            <div className="space-y-6">
              <div className="bg-secondary/20 border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Validation Result</p>
                  <span className={`font-mono font-bold uppercase text-lg ${verdictColor(validation.verdict)}`}>
                    {validation.verdict}
                  </span>
                </div>
                {validation.scores && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(validation.scores)
                      .filter(([k]) => k !== "overall")
                      .map(([key, s]) => (
                        <div key={key} className="flex items-center justify-between text-xs font-mono">
                          <span className="text-muted-foreground capitalize">{key}</span>
                          <span className={s.score >= 60 ? "text-green-400" : "text-orange-400"}>{s.score}/100</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Choose your execution path:</p>
                {(["current", "adjusted", "alternative"] as PathType[]).map((pathKey) => {
                  const path = validation.paths?.[pathKey];
                  if (!path) return null;
                  const isSelected = selectedPath === pathKey;
                  return (
                    <button
                      type="button"
                      key={pathKey}
                      onClick={() => setSelectedPath(pathKey)}
                      className={`w-full text-left border rounded-xl p-4 cursor-pointer transition-all space-y-2 ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-[0_0_20px_-8px_var(--primary)]"
                          : "border-border bg-secondary/10 hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full border-2 shrink-0 transition-colors ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                            }`}
                          />
                          <span className="font-semibold text-sm">{path.title}</span>
                        </div>
                        <span className={`text-xs font-mono uppercase ${riskColor(path.riskLevel)}`}>
                          {path.riskLevel} risk
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed ml-5">{path.summary}</p>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                  <p className="text-destructive text-sm font-mono">{error}</p>
                </div>
              )}

              <Button
                onClick={handleLaunch}
                disabled={loading || !validation.canProceed}
                className="w-full font-mono uppercase tracking-wider text-xs"
                size="lg"
              >
                Launch Execution Blueprint →
              </Button>
            </div>
          )}

          {step === "launching" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="font-mono text-muted-foreground text-sm">Building your execution blueprint...</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Creating plans, targets, phases, projects, and actions. Generating your first task.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
