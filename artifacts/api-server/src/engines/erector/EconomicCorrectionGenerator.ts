import type { RealityProfileRow } from "./types/verdict-types.js";
import type { EconomicCorrectionSpec } from "./correction/types.js";

const ARCHETYPE_TEMPLATES: Record<string, EconomicCorrectionSpec> = {
  marketplace_exchange: {
    core_correction: "Solve the chicken-and-egg problem first.",
    required_actions: [
      "Start with one side only (supply or demand — not both)",
      "Prove 10 transactions before building the matching platform",
    ],
    required_evidence: ["10 documented successful matches"],
    user_visible_reason:
      "Your marketplace model needs proof that both sides will transact before you scale the platform.",
    unblock_condition: "Re-simulation shows no hard veto after transaction proof",
    revalidation_required: true,
  },
  saas_platform: {
    core_correction: "Find the painful workflow before building the product.",
    required_actions: [
      "Interview 10 potential users about their most painful workflow",
      "Get 3 people to agree to use a manual version of the solution",
    ],
    required_evidence: ["Signed agreement or payment from pilot user"],
    user_visible_reason:
      "Your SaaS path needs validated workflow pain and paid pilot commitment before build-out.",
    unblock_condition: "Re-simulation returns no hard veto after pilot proof",
    revalidation_required: true,
  },
  direct_service_delivery: {
    core_correction: "Make your offer and find your first paid client.",
    required_actions: [
      "Write one specific offer (who, what, price, timeline)",
      "Send it to 10 potential clients",
    ],
    required_evidence: ["One paid engagement or signed agreement"],
    user_visible_reason:
      "Your service model needs a concrete offer and at least one paying client before scaling.",
    unblock_condition: "Re-simulation returns no hard veto after paid client proof",
    revalidation_required: true,
  },
  content_media: {
    core_correction: "Build an owned audience before monetizing.",
    required_actions: [
      "Publish 8 pieces of content to a single platform",
      "Get 50 email subscribers from the content",
    ],
    required_evidence: ["Email list export showing 50+ subscribers"],
    user_visible_reason:
      "Your content model needs owned audience traction before monetization assumptions hold.",
    unblock_condition: "Re-simulation returns no hard veto after audience proof",
    revalidation_required: true,
  },
  physical_product_inventory: {
    core_correction: "Validate margin and supply before holding inventory.",
    required_actions: [
      "Source 1 unit at cost price",
      "Sell it at target price to prove margin",
    ],
    required_evidence: ["Cost receipt + sale receipt"],
    user_visible_reason:
      "Your product model needs unit economics proof before inventory commitment.",
    unblock_condition: "Re-simulation returns no hard veto after margin proof",
    revalidation_required: true,
  },
  information_knowledge_product: {
    core_correction: "Prove distribution before scaling the product.",
    required_actions: [
      "Identify one distribution channel you control",
      "Generate 20 pre-sales or waitlist signups from that channel",
    ],
    required_evidence: ["Pre-sale receipts or verified waitlist export"],
    user_visible_reason:
      "Your knowledge product needs distribution proof before launch assumptions hold.",
    unblock_condition: "Re-simulation returns no hard veto after distribution proof",
    revalidation_required: true,
  },
  subscription_recurring: {
    core_correction: "Prove retention before assuming recurring revenue.",
    required_actions: [
      "Run a 30-day pilot with at least 5 subscribers",
      "Document churn and renewal intent",
    ],
    required_evidence: ["Retention cohort data over 30+ days"],
    user_visible_reason:
      "Your subscription model needs retention signal before recurring revenue is assumed.",
    unblock_condition: "Re-simulation returns no hard veto after retention proof",
    revalidation_required: true,
  },
  consulting_advisory: {
    core_correction: "Convert positioning into scoped paid engagements.",
    required_actions: [
      "Define one scoped engagement package with fixed price",
      "Deliver paid discovery sessions to 3 qualified prospects",
    ],
    required_evidence: ["Signed SOW, retainer, or paid discovery session"],
    user_visible_reason:
      "Your advisory model needs paid scoped engagements before scaling delivery capacity.",
    unblock_condition: "Re-simulation returns no hard veto after engagement proof",
    revalidation_required: true,
  },
  social_enterprise_mission: {
    core_correction: "Secure mission-aligned funding or buyer commitment.",
    required_actions: [
      "Identify primary funder or impact buyer profile",
      "Secure grant award, donor pledge, or impact contract",
    ],
    required_evidence: ["Grant award letter, donor pledge, or impact contract"],
    user_visible_reason:
      "Your mission model needs committed funding or impact buyers before scaling operations.",
    unblock_condition: "Re-simulation returns no hard veto after funding proof",
    revalidation_required: true,
  },
  collective_community: {
    core_correction: "Prove member activation and retention before scaling community.",
    required_actions: [
      "Define activation milestone for new members",
      "Achieve 30-day retention above your archetype threshold",
    ],
    required_evidence: ["Member activation rate and 30-day retention report"],
    user_visible_reason:
      "Your community model needs participation and retention proof before growth assumptions hold.",
    unblock_condition: "Re-simulation returns no hard veto after retention proof",
    revalidation_required: true,
  },
};

const GENERIC_TEMPLATE: EconomicCorrectionSpec = {
  core_correction: "Collect stronger economic proof before launch.",
  required_actions: [
    "Identify the weakest assumption in your current model",
    "Submit evidence that directly tests that assumption",
  ],
  required_evidence: ["HIGH strength evidence tied to revenue or customer commitment"],
  user_visible_reason:
    "Your economic model needs stronger proof before launch can proceed safely.",
  unblock_condition: "Re-simulation returns no hard veto",
  revalidation_required: true,
};

function personalizeActions(
  actions: string[],
  profile?: RealityProfileRow | null,
): string[] {
  if (!profile) return actions;
  const budgetHint = profile.budget_range ? ` (budget: ${profile.budget_range})` : "";
  const locationHint = profile.location ? ` in ${profile.location}` : "";
  return actions.map((action) => {
    if (action.includes("10 potential")) {
      return `${action}${locationHint}${budgetHint}`;
    }
    return action;
  });
}

export function generateEconomicCorrection(input: {
  archetype: string;
  failureType: string;
  realityProfile?: RealityProfileRow | null;
  probabilityProceed?: number | null;
}): EconomicCorrectionSpec {
  const template = ARCHETYPE_TEMPLATES[input.archetype] ?? GENERIC_TEMPLATE;
  const lowProbability =
    input.probabilityProceed != null && input.probabilityProceed < 25;

  const failurePrefix =
    input.failureType === "framework_veto"
      ? "Framework review blocked launch. "
      : lowProbability
        ? "Launch probability is below safe threshold. "
        : "";

  return {
    ...template,
    user_visible_reason: `${failurePrefix}${template.user_visible_reason}`,
    required_actions: personalizeActions(template.required_actions, input.realityProfile),
    required_evidence: [...template.required_evidence],
  };
}

export function listSupportedArchetypes(): string[] {
  return Object.keys(ARCHETYPE_TEMPLATES);
}
