/**
 * Registers Bhudhi contracts for TORGIMA_ERECTOR_COMPLETE_SYSTEM (refine + 20 stages).
 */
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { PromptRegistry } from "./PromptRegistry.js";
import type { BhudhiProvider } from "./bhudhiProviders.js";

const SEARCH_STAGES = new Set([
  "VALIDATE_STAGE_4_PATTERNS",
  "VALIDATE_STAGE_5_TIMING",
  "VALIDATE_STAGE_6_MARKET",
  "VALIDATE_STAGE_7_CHANNELS",
]);

function register(
  triggerType: BhudhiTriggerType,
  purpose: string,
  provider?: BhudhiProvider,
  dataShape = "{}",
) {
  const prov = provider ?? "claude";
  PromptRegistry.register({
    name: `erector.${triggerType.toLowerCase()}.v1`,
    version: "1.0",
    triggerType,
    provider: prov,
    mode: "STRUCTURE",
    outputType: "erector_market",
    maxTokens: 1200,
    temperature: 0.25,
    memoryAllowed: true,
    fallbackKey: `fallback.${triggerType.toLowerCase()}`,
    systemPrompt: `You are Bhudhi for The Erector validation system. ${purpose} Return ONLY valid JSON in the data field. No markdown.`,
    buildUserPrompt: (ctx) =>
      `Context: ${JSON.stringify(ctx)}\nReturn JSON data shape similar to: ${dataShape}`,
  });
}

let registered = false;

export function ensureErectorCompletePromptsRegistered() {
  if (registered) return;
  registered = true;

  register("ERECTOR_GOAL_REFINE", "Generate exactly 3 refined goal options with angle simple|targeted|business.", "claude", '{ "options": [{ "text": "", "angle": "" }] }');
  register("ERECTOR_PURPOSE_REFINE", "Generate exactly 3 purpose options with angle problem|transformation|market.", "claude", '{ "options": [{ "text": "", "angle": "" }] }');

  register("VALIDATE_STAGE_2_DECOMPOSITION", "Purpose decomposition: problem_claim, target_user, change_claim, value_claim.");
  register("VALIDATE_STAGE_3_ECONOMIC", "Economic profile for country and business type.");
  register("VALIDATE_STAGE_4_PATTERNS", "3 successful businesses with explanations — use current public knowledge.", "claude");
  register("VALIDATE_STAGE_5_TIMING", "Economy and timing analysis — use current public knowledge.", "claude");
  register("VALIDATE_STAGE_6_MARKET", "3 market points: demand, competition, opportunity — use current public knowledge.", "claude");
  register("VALIDATE_STAGE_7_CHANNELS", "Social and distribution channels with why each matters — use current public knowledge.", "claude");
  register("VALIDATE_STAGE_8_PROS", "4 pros with explanations.");
  register("VALIDATE_STAGE_9_CONS", "4 cons with risk explanations.");
  register("VALIDATE_STAGE_10_FEASIBILITY", "Feasibility: technical, time, budget, skill, resource_gaps, overall.");
  register("VALIDATE_STAGE_11_VIABILITY", "Business viability assessment.");
  register("VALIDATE_STAGE_12_BOOTSTRAP", "Bootstrap plan with minimal resources.");
  register("VALIDATE_STAGE_13_FEATURES", "build_first, build_later, avoid_now arrays.");
  register("VALIDATE_STAGE_14_CUSTOMER", "Customer definition: primary, secondary, avoid, first_100_users.");
  register("VALIDATE_STAGE_15_POSITIONING", "Positioning: unique_angle, switching_reason, message, differentiation.");
  register("VALIDATE_STAGE_16_DIFFICULTY", "Difficulty breakdown: building, marketing, retention, operations.");
  register("VALIDATE_STAGE_17_REVENUE", "Revenue paths array.");
  register("VALIDATE_STAGE_18_90DAYS", "month_1, month_2, month_3, milestone.");
  register("VALIDATE_STAGE_19_PATHS", "foundation, momentum, overdrive path objects.");
  register("VALIDATE_STAGE_20_DECISION", "decision proceed|adjust|delay|pivot and explanation.");
}
