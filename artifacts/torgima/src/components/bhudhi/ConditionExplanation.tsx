import { IntelligencePanel } from "./IntelligencePanel";

export function ConditionExplanation({
  explanation,
  condition,
  confidenceTier = "MEDIUM",
}: {
  explanation: string;
  condition?: string;
  confidenceTier?: "HIGH" | "MEDIUM" | "LOW";
}) {
  return (
    <IntelligencePanel
      type="explanation"
      title="System Intelligence"
      content={explanation}
      userCondition={condition}
      confidenceTier={confidenceTier}
      expandable
    />
  );
}
