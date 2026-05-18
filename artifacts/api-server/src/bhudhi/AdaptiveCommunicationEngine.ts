import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateUncertaintyDisclosure } from "../engines/meta/MetaCognitionEngine.js";
import { normalizeCondition } from "./agents/conditionMaps.js";

export interface CommunicationProfile {
  tone?: "direct" | "standard" | "warm";
  detailLevel?: "brief" | "standard" | "detailed";
}

export interface CommunicationContext {
  userId: string;
  userCondition?: string;
  communicationProfile?: CommunicationProfile;
  outputType?: string;
  confidenceTier?: "HIGH" | "MEDIUM" | "LOW";
  cognitiveLoad?: number;
}

export interface FilteredOutput {
  content: string;
  appliedTone: string;
  densityLevel: "brief" | "standard" | "detailed";
  uncertaintyNote: string | null;
  suppressed: boolean;
}

const LANGUAGE_SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/\bgreat job\b/gi, "execution continuity maintained"],
  [/\bcongratulations\b/gi, "milestone reached"],
  [/\byou did it\b/gi, "phase execution complete"],
  [/\bto-do\b/gi, "Order"],
  [/\bchecklist\b/gi, "execution sequence"],
  [/\btasks\b/gi, "Orders"],
  [/\btask\b/gi, "Order"],
  [/\bplans\b/gi, "Blueprints"],
  [/\bplan\b/gi, "Blueprint"],
  [/\bscores\b/gi, "Signals"],
  [/\bscore\b/gi, "Signal"],
  [/\bstatus\b/gi, "Condition"],
  [/\bstages\b/gi, "Phases"],
  [/\bstage\b/gi, "Phase"],
];

export function applyExecutionLanguage(text: string): string {
  let out = text;
  for (const [pattern, replacement] of LANGUAGE_SUBSTITUTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function densityFromProfile(
  profile: CommunicationProfile | undefined,
  cognitiveLoad?: number,
): "brief" | "standard" | "detailed" {
  if ((cognitiveLoad ?? 0.5) > 0.75) return "brief";
  return profile?.detailLevel ?? "standard";
}

function trimToDensity(text: string, density: "brief" | "standard" | "detailed"): string {
  const max =
    density === "brief" ? 280 : density === "detailed" ? 1200 : 600;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function getUncertaintyNote(
  confidenceTier: string,
  _outputType?: string,
): string | null {
  if (confidenceTier === "HIGH") return null;
  if (confidenceTier === "MEDIUM") return "This analysis is based on available patterns.";
  return "This estimate is based on limited data and will improve with more execution.";
}

export async function filterForUser(
  rawOutput: string | Record<string, unknown>,
  context: CommunicationContext,
): Promise<FilteredOutput> {
  const [user] = await db
    .select({ communication_profile: users.communication_profile })
    .from(users)
    .where(eq(users.id, context.userId))
    .limit(1);

  const profile =
    context.communicationProfile ??
    (user?.communication_profile as CommunicationProfile | null) ??
    { tone: "standard", detailLevel: "standard" };

  const condition = normalizeCondition(context.userCondition ?? "stability");
  const density = densityFromProfile(profile, context.cognitiveLoad);
  const appliedTone = profile.tone ?? "standard";

  let text =
    typeof rawOutput === "string" ?
      rawOutput
    : formatStructuredOutput(rawOutput);

  text = applyExecutionLanguage(text);
  text = trimToDensity(text, density);

  const tier = context.confidenceTier ?? "MEDIUM";
  const uncertaintyNote =
    tier === "LOW" ?
      (await generateUncertaintyDisclosure("STRATEGY", condition, "LOW").catch(() =>
        getUncertaintyNote("LOW"),
      )) ?? getUncertaintyNote("LOW")
    : getUncertaintyNote(tier, context.outputType);

  const suppressed = text.trim().length === 0;

  return {
    content: text,
    appliedTone,
    densityLevel: density,
    uncertaintyNote,
    suppressed,
  };
}

function formatStructuredOutput(raw: Record<string, unknown>): string {
  if (typeof raw.explanation === "string") return raw.explanation;
  if (typeof raw.interpretation === "string") return raw.interpretation;
  if (typeof raw.content === "string") return raw.content;
  if (typeof raw.recommendation === "string") return raw.recommendation;
  if (Array.isArray(raw.steps)) {
    return (raw.steps as string[]).map((s, i) => `${i + 1}. ${s}`).join("\n");
  }
  if (raw.data && typeof raw.data === "object") {
    return formatStructuredOutput(raw.data as Record<string, unknown>);
  }
  return "Execution intelligence is available for your current Blueprint.";
}
