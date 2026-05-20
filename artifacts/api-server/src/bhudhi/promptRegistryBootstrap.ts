/**
 * Bhudhi B2 — attach Zod schemas, mode variants, and advanced intelligence aliases.
 */
import type { BhudhiTriggerType, BhudhiMode, BhudhiOutputType } from "../types/bhudhi.js";
import type { PromptContract } from "./PromptRegistry.js";
import {
  OUTPUT_ENVELOPE_SCHEMAS,
  envelopeSchema,
  goalMissingFieldsDataSchema,
  structuredGoalDataSchema,
} from "./schemas/outputSchemas.js";

type RegistryMaps = {
  registry: Map<BhudhiTriggerType, PromptContract>;
  modeRegistry: Map<string, PromptContract>;
  byName: Map<string, PromptContract>;
};

export function bootstrapPromptRegistry(maps: RegistryMaps): void {
  const { registry, modeRegistry, byName } = maps;

  for (const contract of registry.values()) {
    const schema = OUTPUT_ENVELOPE_SCHEMAS[contract.outputType];
    if (schema) contract.outputSchema = schema;
    if (contract.timeoutMs === undefined) {
      contract.timeoutMs = contract.triggerType === "TASK_DRAFTING" ? 5_000 : 10_000;
    }
    if (!contract.allowedSources) contract.allowedSources = ["INTERNAL"];
    modeRegistry.set(`${contract.triggerType}/${contract.mode}`, contract);
    byName.set(contract.name, contract);
  }

  const goalBase = registry.get("GOAL_STRUCTURING");
  if (goalBase) {
    const missingFields: PromptContract = {
      ...goalBase,
      name: "goal.missing_fields.v1",
      version: "1.0",
      mode: "STRUCTURE",
      outputSchema: envelopeSchema("structured_goal", goalMissingFieldsDataSchema),
      systemPrompt:
        goalBase.systemPrompt +
        "\nFocus ONLY on missing required goal fields. Do not rewrite the full goal.",
      buildUserPrompt: (ctx) => `
Raw goal: "${String(ctx["rawGoal"] ?? ctx["userInput"] ?? "")}"
Known missing fields: ${JSON.stringify(ctx["missingRequiredFields"] ?? ctx["missingFields"] ?? [])}

Return ONLY JSON envelope with outputType structured_goal and data:
{
  "missingFields": ["field names still required"],
  "questionToAsk": "one precise question",
  "priority": "goal|purpose|timeframe|commitment|context"
}
Also include cleanedGoal (may be empty string), domainHints [], ambiguityFlags [], missingRequiredFields [].
stateVersion: ${ctx["stateVersion"] ?? 0}
`,
    };
    modeRegistry.set("GOAL_STRUCTURING/MISSING_FIELDS", missingFields);
    byName.set("goal.missing_fields.v1", missingFields);
  }

  registerAdvancedVariant(maps, "ROOT_CAUSE_ASSIST", "INTERPRET", {
    name: "failure.root_investigate.v1",
    systemSuffix:
      "\nInvestigation mode: propose root-cause hypotheses with evidence chains. Do not prescribe unauthorized tasks.",
  });

  registerAdvancedVariant(maps, "FEEDBACK_CLASSIFICATION", "INTERPRET", {
    name: "feedback.critic.v1",
    systemSuffix: "\nCritic mode: evaluate feedback quality and consistency with proof obligations only.",
  });

  registerAdvancedVariant(maps, "STATE_EXPLANATION", "EXPLAIN", {
    name: "state.coaching.v1",
    systemSuffix:
      "\nCoaching mode: explain psychology-safe next steps without changing condition or enforcement.",
  });

  registerAdvancedVariant(maps, "GOAL_STRUCTURING", "INTERPRET", {
    name: "goal.eis_extended.v1",
    triggerType: "GOAL_STRUCTURING",
    systemSuffix:
      "\nExtended industry framing: interpret market context only from supplied facts — no live data claims.",
  });

  registerAdvancedVariant(maps, "TASK_DRAFTING", "DRAFT", {
    name: "task.simulation.v1",
    systemSuffix: "\nSimulation mode: draft scenario-based execution steps without inventing unlock mechanics.",
  });

  registerAdvancedVariant(maps, "OUTCOME_EVIDENCE_SUMMARY", "INTERPRET", {
    name: "outcome.reality_check.v1",
    systemSuffix: "\nReality intelligence mode: summarize evidence credibility gaps only.",
  });

  registerAdvancedVariant(maps, "STATE_EXPLANATION", "SUGGEST", {
    name: "state.prediction.v1",
    systemSuffix: "\nPredictive signals mode: suggest trajectory interpretation — not authoritative forecasts.",
  });

  const rootBase = maps.registry.get("ROOT_CAUSE_ASSIST");
  if (rootBase) {
    const meta: PromptContract = {
      ...rootBase,
      name: "failure.meta_cognition.v1",
      mode: "SUGGEST",
      systemPrompt:
        rootBase.systemPrompt +
        "\nMeta-cognition mode: reflect on thinking patterns behind repeated friction.",
    };
    maps.byName.set(meta.name, meta);
  }

  registerAdvancedVariant(maps, "GOAL_STRUCTURING", "SUGGEST", {
    name: "goal.path_compare.v1",
    triggerType: "GOAL_STRUCTURING",
    outputType: "structured_goal",
    systemSuffix: "\nDebate/path comparison: compare paths in data.domainHints and ambiguityFlags only.",
  });
}

function registerAdvancedVariant(
  maps: RegistryMaps,
  triggerType: BhudhiTriggerType,
  mode: BhudhiMode,
  opts: {
    name: string;
    triggerType?: BhudhiTriggerType;
    outputType?: BhudhiOutputType;
    systemSuffix: string;
  },
): void {
  const base = maps.registry.get(triggerType);
  if (!base) return;

  const variant: PromptContract = {
    ...base,
    name: opts.name,
    mode,
    triggerType: opts.triggerType ?? triggerType,
    outputType: opts.outputType ?? base.outputType,
    systemPrompt: base.systemPrompt + opts.systemSuffix,
    outputSchema:
      OUTPUT_ENVELOPE_SCHEMAS[opts.outputType ?? base.outputType] ?? base.outputSchema,
  };

  maps.modeRegistry.set(`${variant.triggerType}/${mode}`, variant);
  maps.byName.set(opts.name, variant);
}
