import { EVENT_TYPES } from "../../../services/EventService.js";
import type { EventType } from "../../../types/eventContracts.js";

export type BlockerCategory =
  | "DEPENDENCY_MISSING"
  | "EXTERNAL_WAIT"
  | "CLARITY_NEEDED"
  | "CAPABILITY_GAP"
  | "RESOURCE_MISSING"
  | "OTHER";

export type BlockerClassification = {
  blocker_category: BlockerCategory;
  recommended_resolution: string;
  resolution_event: EventType;
};

const KEYWORD_RULES: Array<{ category: BlockerCategory; patterns: RegExp[]; resolution: string; event: EventType }> = [
  {
    category: "EXTERNAL_WAIT",
    patterns: [/client/i, /\bwaiting\b/i, /approval/i, /response/i, /supplier/i],
    resolution: "Track external wait and set a follow-up checkpoint.",
    event: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
  },
  {
    category: "DEPENDENCY_MISSING",
    patterns: [/waiting for/i, /\bneeds\b/i, /depends on/i, /blocked by/i],
    resolution: "Resolve prerequisite task or dependency before continuing.",
    event: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
  },
  {
    category: "CLARITY_NEEDED",
    patterns: [/unclear/i, /confused/i, /dont know/i, /don't know/i, /unsure/i],
    resolution: "Clarify task requirements with a focused explanation task.",
    event: EVENT_TYPES.CLARIFICATION_TASK_REQUESTED,
  },
  {
    category: "CAPABILITY_GAP",
    patterns: [/cant do/i, /can't do/i, /dont know how/i, /don't know how/i, /need to learn/i],
    resolution: "Route to academy capability support.",
    event: EVENT_TYPES.ACADEMY_TASK_REQUESTED,
  },
  {
    category: "RESOURCE_MISSING",
    patterns: [/no access/i, /\bneed\b/i, /budget/i, /\btool\b/i, /material/i],
    resolution: "Identify missing resource and create recovery task.",
    event: EVENT_TYPES.RECOVERY_TASK_REQUESTED,
  },
];

export function classifyBlocker(details: string): BlockerClassification {
  const text = details.trim();
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return {
        blocker_category: rule.category,
        recommended_resolution: rule.resolution,
        resolution_event: rule.event,
      };
    }
  }
  return {
    blocker_category: "OTHER",
    recommended_resolution: "Manual blocker review requested.",
    resolution_event: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
  };
}

export async function classifyBlockerWithBhudhiFallback(
  details: string,
  bhudhiCategory?: BlockerCategory,
): Promise<BlockerClassification> {
  const keyword = classifyBlocker(details);
  if (keyword.blocker_category !== "OTHER") return keyword;
  if (bhudhiCategory && bhudhiCategory !== "OTHER") {
    const rule = KEYWORD_RULES.find((r) => r.category === bhudhiCategory);
    if (rule) {
      return {
        blocker_category: bhudhiCategory,
        recommended_resolution: rule.resolution,
        resolution_event: rule.event,
      };
    }
  }
  return keyword;
}
