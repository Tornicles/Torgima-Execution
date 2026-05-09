import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TerminalSquare, Loader2, AlertCircle } from "lucide-react";
import { useRunValidation, useStructureGoal, useCreateBlueprint, useActivateBlueprint } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function Onboarding() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [rawGoal, setRawGoal] = useState("");
  const [validationData, setValidationData] = useState<any>(null);
  const [structureData, setStructureData] = useState<any>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);

  const validateGoal = useRunValidation();
  const structureGoal = useStructureGoal();
  const createBlueprint = useCreateBlueprint();
  const activateBlueprint = useActivateBlueprint();

  const handleValidate = () => {
    if (!rawGoal.trim()) return;
    validateGoal.mutate(
      { data: { rawGoal } },
      {
        onSuccess: (res) => {
          setValidationData(res);
          setStep(2);
        },
        onError: () => {
          toast({ title: "Validation failed", variant: "destructive" });
        }
      }
    );
  };

  const handleStructure = () => {
    structureGoal.mutate(
      { data: { rawGoal, context: validationData?.refinedGoal } },
      {
        onSuccess: (res) => {
          setStructureData(res);
          setStep(3);
        },
        onError: () => {
          toast({ title: "Structuring failed", variant: "destructive" });
        }
      }
    );
  };

  const handleCreateAndActivate = () => {
    createBlueprint.mutate(
      { data: { rawGoal, domain: structureData?.domain } },
      {
        onSuccess: (res) => {
          const id = res.id;
          setBlueprintId(id);
          activateBlueprint.mutate(
            { id },
            {
              onSuccess: () => {
                toast({ title: "Blueprint Activated" });
                setLocation(`/blueprint/${id}`);
              }
            }
          );
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
            <TerminalSquare className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">INITIALIZE SYSTEM</h1>
          <div className="w-full max-w-md mx-auto">
            <Progress value={(step / 3) * 100} className="h-1 bg-secondary" />
          </div>
        </div>

        <Card className="border-primary/20 shadow-2xl bg-card/80 backdrop-blur-xl">
          <CardContent className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold font-mono">STATE YOUR OBJECTIVE</h2>
                  <p className="text-sm text-muted-foreground">Be raw. Be honest. What are you trying to accomplish?</p>
                </div>
                <Textarea
                  value={rawGoal}
                  onChange={(e) => setRawGoal(e.target.value)}
                  placeholder="e.g., I want to build a saas app but I keep procrastinating and watching youtube instead of coding..."
                  className="min-h-[150px] font-mono text-sm bg-background border-border resize-none focus-visible:ring-primary/50"
                />
                <Button
                  onClick={handleValidate}
                  disabled={!rawGoal.trim() || validateGoal.isPending}
                  className="w-full font-mono font-bold tracking-widest"
                >
                  {validateGoal.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  ANALYZE INTENT
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold font-mono">BHUDHI ANALYSIS</h2>
                  <p className="text-sm text-muted-foreground">The system has evaluated your objective.</p>
                </div>

                <div className="p-4 bg-secondary rounded border border-border space-y-4 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">CLARITY SCORE:</span>
                    <span className={`font-bold ${validationData?.score > 70 ? 'text-green-500' : 'text-amber-500'}`}>
                      {validationData?.score}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">FEEDBACK:</span>
                    <p className="text-foreground">{validationData?.feedback}</p>
                  </div>
                  {validationData?.refinedGoal && (
                    <div>
                      <span className="text-primary block mb-1">REFINED INTENT:</span>
                      <p className="text-foreground border-l-2 border-primary pl-3 py-1 bg-primary/5">{validationData.refinedGoal}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="font-mono w-1/3">REVISE</Button>
                  <Button
                    onClick={handleStructure}
                    disabled={structureGoal.isPending}
                    className="font-mono font-bold w-2/3"
                  >
                    {structureGoal.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    GENERATE BLUEPRINT
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold font-mono text-primary">BLUEPRINT PREPARED</h2>
                  <h3 className="text-lg font-bold">{structureData?.title}</h3>
                </div>

                <div className="space-y-4 font-mono text-sm max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  {structureData?.phases?.map((phase: string, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded bg-primary/20 text-primary flex items-center justify-center font-bold text-xs border border-primary/30">
                        {i + 1}
                      </div>
                      <div className="pt-0.5 text-muted-foreground">{phase}</div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded">
                  <div className="flex gap-2 text-destructive font-mono text-sm font-bold mb-2">
                    <AlertCircle className="w-4 h-4" /> WARNING
                  </div>
                  <p className="text-xs text-destructive/80 font-mono">
                    Activating this blueprint hands execution authority over to Torgima. You will be held to the standard required to achieve this goal.
                  </p>
                </div>

                <Button
                  onClick={handleCreateAndActivate}
                  disabled={createBlueprint.isPending || activateBlueprint.isPending}
                  className="w-full font-mono font-bold tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 h-12"
                >
                  {(createBlueprint.isPending || activateBlueprint.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  ACKNOWLEDGE AND ACTIVATE
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
