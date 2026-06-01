/**
 * Tier structure previews — derived from BlueprintTypeRegistry (single source for generation).
 */
import type { BlueprintTier } from "./infrastructure/blueprint-types.js";
import { getBlueprintTypeConfig } from "./infrastructure/BlueprintTypeRegistry.js";

export type BlueprintTierStructurePreview = {
  corePlans: number;
  programs: number;
  phases: number;
  projects: number;
  actions: number;
  setupMinutes: number;
};

export type BlueprintTierCardManifest = {
  id: BlueprintTier;
  label: string;
  subtitle: string;
  recommended: boolean;
  setupTime: string;
  bestFor: string[];
  includes: string[];
  structure: BlueprintTierStructurePreview;
  /** User-facing execution level copy */
  tagline: string;
  tasksPerDay: string;
  difficultyAccess: string;
  structureDepth: string;
  price: string;
};

function computeStructure(tier: BlueprintTier): BlueprintTierStructurePreview {
  const c = getBlueprintTypeConfig(tier);
  const phases = c.planCount * c.phaseCount;
  const projects = phases * c.projectsPerActivePhase;
  const actions = projects * c.actionsPerProject;
  const setupMinutes = tier === "starter" ? 5 : tier === "growth" ? 10 : 15;
  return {
    corePlans: c.planCount,
    programs: c.targetCount,
    phases,
    projects,
    actions,
    setupMinutes,
  };
}

const STARTER_INCLUDES = [
  "3 Core Plans",
  "9 Programs (Targets)",
  "24 Phases",
  "68 Projects",
  "215 Actions",
  "Daily Orders (Adaptive)",
  "Signal System",
  "Basic Reports",
];

const GROWTH_INCLUDES = [
  "5 Core Plans",
  "15 Programs",
  "40 Phases",
  "120 Projects",
  "360 Actions",
  "Advanced Signal System",
  "Smart Condition Control",
  "Performance Reports",
  "Risk Reports",
];

const ULTIMATE_INCLUDES = [
  "8 Core Plans",
  "25+ Programs",
  "80+ Phases",
  "250+ Projects",
  "750+ Actions",
  "Advanced Signal Intelligence",
  "AI Condition Orchestration",
  "Executive Dashboard",
  "Deep Reports",
  "Team Collaboration (Coming Soon)",
];

/** Display lines use registry-derived counts where the label includes a number. */
function includesWithLiveCounts(tier: BlueprintTier, template: string[]): string[] {
  const s = computeStructure(tier);
  const map: Record<string, string> = {
    "3 Core Plans": `${s.corePlans} Core Plans`,
    "9 Programs (Targets)": `${s.programs} Programs (Targets)`,
    "24 Phases": `${s.phases} Phases`,
    "68 Projects": `${s.projects} Projects`,
    "215 Actions": `${s.actions} Actions`,
    "5 Core Plans": `${s.corePlans} Core Plans`,
    "15 Programs": `${s.programs} Programs`,
    "40 Phases": `${s.phases} Phases`,
    "120 Projects": `${s.projects} Projects`,
    "360 Actions": `${s.actions} Actions`,
    "8 Core Plans": `${s.corePlans} Core Plans`,
    "25+ Programs": `${s.programs}+ Programs`,
    "80+ Phases": `${s.phases}+ Phases`,
    "250+ Projects": `${s.projects}+ Projects`,
    "750+ Actions": `${s.actions}+ Actions`,
  };
  return template.map((line) => map[line] ?? line);
}

export const BLUEPRINT_TIER_CARDS: BlueprintTierCardManifest[] = [
  {
    id: "starter",
    label: "Starter",
    subtitle: "Getting going with a clear simple system",
    tagline: "Getting going with a clear simple system",
    recommended: false,
    setupTime: "~5 min",
    tasksPerDay: "3 tasks/day",
    difficultyAccess: "Easy tasks",
    structureDepth: "3 stages",
    price: "Free / $9/mo",
    bestFor: ["New ideas", "Individuals", "Small projects", "Early-stage execution"],
    includes: includesWithLiveCounts("starter", STARTER_INCLUDES),
    structure: computeStructure("starter"),
  },
  {
    id: "growth",
    label: "Growth",
    subtitle: "Serious about building this into something real",
    tagline: "Serious about building this into something real",
    recommended: true,
    setupTime: "~10 min",
    tasksPerDay: "7 tasks/day",
    difficultyAccess: "All task types",
    structureDepth: "4 stages",
    price: "$29/month",
    bestFor: ["Growing businesses", "Scaling projects", "Teams", "Revenue growth"],
    includes: includesWithLiveCounts("growth", GROWTH_INCLUDES),
    structure: computeStructure("growth"),
  },
  {
    id: "ultimate",
    label: "Ultimate",
    subtitle: "Maximum depth and control",
    tagline: "Maximum depth and control",
    recommended: false,
    setupTime: "~15 min",
    tasksPerDay: "8 tasks/day",
    difficultyAccess: "Advanced",
    structureDepth: "4 stages+",
    price: "$79/month",
    bestFor: ["Large organizations", "Complex systems", "Multi-team execution", "Long-term growth"],
    includes: includesWithLiveCounts("ultimate", ULTIMATE_INCLUDES),
    structure: computeStructure("ultimate"),
  },
];

export const BLUEPRINT_CREATION_FLOW = [
  { key: "plans", label: "Plans", description: "Outcome stages to achieve your goal" },
  { key: "seasons", label: "Seasons", description: "Time windows that drive execution" },
  { key: "programs", label: "Programs", description: "Measurable targets for each plan" },
  { key: "phases", label: "Phases", description: "Step-by-step phases for each program" },
  { key: "projects", label: "Projects", description: "Organized work to deliver phase outcomes" },
  { key: "actions", label: "Actions", description: "Specific tasks required to complete projects" },
  { key: "orders", label: "Orders", description: "Daily executable orders based on condition" },
  { key: "signals", label: "Signals", description: "Reality signals that measure execution" },
  { key: "adaptive", label: "Adaptive System", description: "AI-driven adaptation based on results" },
] as const;

export function getTierCard(id: BlueprintTier): BlueprintTierCardManifest {
  const card = BLUEPRINT_TIER_CARDS.find((c) => c.id === id);
  if (!card) return BLUEPRINT_TIER_CARDS[0]!;
  return card;
}
