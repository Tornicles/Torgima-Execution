import type { ReactNode } from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api-base";

type Step = "goal" | "context" | "validating" | "paths" | "launching";

interface GoalInput {
  rawGoal: string;
  purpose: string;
  timeframe: string;
  commitmentLevel: "low" | "medium" | "high" | "full";
  currentContext: string;
  successSignal: string;
  knownBlockers: string;
}

interface ValidationResult {
  blueprintId: string;
  verdict: string;
  scores: Record<string, { score: number; finding: string }>;
  paths: Record<string, { title: string; summary: string; riskLevel: string }>;
  canProceed: boolean;
}

type GoalApiData = {
  status?: string;
  blueprintId?: string;
  verdict?: string;
  scores?: Record<string, { score: number; finding?: string }>;
  paths?: Record<string, { title: string; summary: string; riskLevel: string }>;
  canProceed?: boolean;
  missingFields?: unknown;
};

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("goal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<"current" | "adjusted" | "alternative">("current");
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
    setLoading(true);
    setError("");
    setStep("validating");
    try {
      const res = await fetch(`${API_BASE_URL}/api/onboarding/goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...input,
          idempotencyKey: `onboarding:${Date.now()}`,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; data?: GoalApiData; error?: { message?: string } };
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? "Validation failed.");
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
        setError(typeof d.missingFields === "string" ? d.missingFields : "Goal could not be validated. Refine your goal.");
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
      setError("Cannot connect to server.");
      setStep("context");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!validation?.blueprintId) return;
    setLoading(true);
    setError("");
    setStep("launching");
    try {
      const res = await fetch(`${API_BASE_URL}/api/blueprints/${validation.blueprintId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ selectedPath }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? "Failed to launch blueprint.");
        setStep("paths");
        return;
      }
      await fetch(`${API_BASE_URL}/api/onboarding/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      setLocation("/dashboard");
    } catch {
      setError("Cannot connect to server.");
      setStep("paths");
    } finally {
      setLoading(false);
    }
  }

  const riskColor = (r: string) =>
    r === "low" ? "text-green-400" : r === "medium" ? "text-yellow-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold font-mono">
            {step === "goal" && "Define Your Goal"}
            {step === "context" && "Set The Context"}
            {step === "validating" && "Analysing..."}
            {step === "paths" && "Choose Your Path"}
            {step === "launching" && "Launching Blueprint..."}
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase">
            {step === "goal" && "Step 1 of 3"}
            {step === "context" && "Step 2 of 3"}
            {(step === "paths" || step === "validating" || step === "launching") && "Step 3 of 3"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          {step === "goal" && (
            <>
              <Field label="What is your goal?" required>
                <textarea
                  value={input.rawGoal}
                  onChange={(e) => update("rawGoal", e.target.value)}
                  placeholder="Be specific. What exactly will be different when this is achieved?"
                  rows={3}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <Field label="Why does this matter?" required>
                <textarea
                  value={input.purpose}
                  onChange={(e) => update("purpose", e.target.value)}
                  placeholder="What changes in your life or work when this is complete?"
                  rows={2}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Timeframe" required>
                  <Input
                    value={input.timeframe}
                    onChange={(e) => update("timeframe", e.target.value)}
                    placeholder="e.g. 90 days"
                  />
                </Field>
                <Field label="Commitment level" required>
                  <select
                    value={input.commitmentLevel}
                    onChange={(e) => update("commitmentLevel", e.target.value as GoalInput["commitmentLevel"])}
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="low">Low — a few hours/week</option>
                    <option value="medium">Medium — daily work</option>
                    <option value="high">High — primary focus</option>
                    <option value="full">Full — everything toward this</option>
                  </select>
                </Field>
              </div>
              <Button
                onClick={() => setStep("context")}
                disabled={!input.rawGoal.trim() || !input.purpose.trim() || !input.timeframe.trim()}
                className="w-full font-mono uppercase text-xs"
              >
                Continue
              </Button>
            </>
          )}

          {step === "context" && (
            <>
              <Field label="Current situation">
                <textarea
                  value={input.currentContext}
                  onChange={(e) => update("currentContext", e.target.value)}
                  placeholder="What is your starting point? What do you already have or know?"
                  rows={2}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <Field label="What does success look like?">
                <Input
                  value={input.successSignal}
                  onChange={(e) => update("successSignal", e.target.value)}
                  placeholder="How will you know when you have achieved this?"
                />
              </Field>
              <Field label="Known blockers (optional)">
                <Input
                  value={input.knownBlockers}
                  onChange={(e) => update("knownBlockers", e.target.value)}
                  placeholder="What might slow you down?"
                />
              </Field>
              {error && <p className="text-destructive text-sm font-mono">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("goal")} className="flex-1 font-mono text-xs uppercase">
                  Back
                </Button>
                <Button onClick={handleValidate} disabled={loading} className="flex-[2] min-w-0 font-mono uppercase text-xs px-8">
                  Validate Goal
                </Button>
              </div>
            </>
          )}

          {step === "validating" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-mono text-muted-foreground text-sm">Analysing your goal...</p>
            </div>
          )}

          {step === "paths" && validation && (
            <>
              <div className="bg-secondary/20 rounded-lg p-4 space-y-1">
                <p className="text-xs font-mono text-muted-foreground uppercase">Validation Result</p>
                <p
                  className={`text-xl font-bold font-mono uppercase ${
                    validation.verdict === "proceed"
                      ? "text-green-400"
                      : validation.verdict === "adjust"
                        ? "text-yellow-400"
                        : "text-orange-400"
                  }`}
                >
                  {validation.verdict}
                </p>
                {validation.scores && (
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {Object.entries(validation.scores)
                      .filter(([k]) => k !== "overall")
                      .map(([key, s]) => (
                        <div key={key} className="text-xs font-mono">
                          <span className="text-muted-foreground capitalize">{key}: </span>
                          <span className={s.score >= 60 ? "text-green-400" : "text-orange-400"}>{s.score}/100</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Choose your execution path:</p>
                {(["current", "adjusted", "alternative"] as const).map((pathType) => {
                  const path = validation.paths?.[pathType];
                  if (!path) return null;
                  return (
                    <button
                      type="button"
                      key={pathType}
                      onClick={() => setSelectedPath(pathType)}
                      className={`w-full text-left border rounded-xl p-4 cursor-pointer transition-all ${
                        selectedPath === pathType
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/10 hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                              selectedPath === pathType ? "border-primary bg-primary" : "border-muted-foreground"
                            }`}
                          />
                          <span className="font-semibold text-sm">{path.title}</span>
                        </div>
                        <span className={`text-xs font-mono ${riskColor(path.riskLevel)}`}>{path.riskLevel} risk</span>
                      </div>
                      <p className="text-muted-foreground text-xs ml-5">{path.summary}</p>
                    </button>
                  );
                })}
              </div>

              {error && <p className="text-destructive text-sm font-mono">{error}</p>}

              <Button onClick={handleLaunch} disabled={loading || !validation.canProceed} className="w-full font-mono uppercase text-xs">
                {loading ? "Launching..." : "Launch Execution Blueprint"}
              </Button>
            </>
          )}

          {step === "launching" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-mono text-muted-foreground text-sm">Building your execution blueprint...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono uppercase text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
