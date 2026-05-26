/**
 * Goal + Purpose Refinement — delegates to BhudhiInterpretationEngine (BHUDHI_SYSTEM_SPECIFICATION).
 */
import type { GoalUnderstanding, PurposeUnderstanding } from "../../types/erector-refinement.js";

function extractObject(raw: string): string {
  const lower = raw.toLowerCase();
  if (/app|platform|software|saas/i.test(raw)) return "digital product";
  if (/store|shop|ecommerce/i.test(raw)) return "commerce business";
  if (/agency|consulting|service/i.test(raw)) return "service business";
  if (/content|youtube|podcast/i.test(raw)) return "content business";
  return "venture";
}

function inferDomain(raw: string): string {
  if (/fitness|health|workout|gym/i.test(raw)) return "health / fitness / mobile";
  if (/food|restaurant|meal/i.test(raw)) return "food / hospitality";
  if (/education|course|learn/i.test(raw)) return "education";
  if (/finance|money|invest/i.test(raw)) return "finance";
  return "general business";
}

export function understandGoalDeterministic(rawGoal: string): GoalUnderstanding {
  const object = extractObject(rawGoal);
  const domain = inferDomain(rawGoal);
  const impliedUser = /african|diaspora/i.test(rawGoal)
    ? "African and diaspora users"
    : /user|customer|people/i.test(rawGoal)
      ? "end users seeking the outcome"
      : "target market not specified";
  const impliedOutcome = rawGoal.replace(/^i want to\s+/i, "").trim() || rawGoal;
  const unclear: string[] = [];
  if (!/african|country|region|city/i.test(rawGoal)) unclear.push("target market geography");
  if (!/subscription|revenue|monetiz|sell|price/i.test(rawGoal)) unclear.push("business model");
  if (!/different|unique|only|first/i.test(rawGoal)) unclear.push("differentiation");
  return { object, domain, impliedUser, impliedOutcome, unclear };
}

export function generateGoalOptionsDeterministic(rawGoal: string, understanding: GoalUnderstanding): string[] {
  const base = rawGoal.replace(/^i want to\s+/i, "").replace(/^build\s+/i, "").trim();
  const topic = base.charAt(0).toUpperCase() + base.slice(1);
  return [
    `Create ${topic} that helps users follow structured steps, track progress, and build consistent habits toward the stated outcome.`,
    `Build ${topic} for a clearly defined niche audience, with culturally relevant execution, progress tracking, and accountability.`,
    `Launch ${topic} as a focused business: prove demand with a minimum version, acquire first users, and validate a repeatable revenue path.`,
  ];
}

export function understandPurposeDeterministic(rawPurpose: string, goalFinal?: string): PurposeUnderstanding {
  const goalHint = goalFinal ? ` Related goal: ${goalFinal.slice(0, 120)}.` : "";
  return {
    problem: /access|lack|hard|difficult/i.test(rawPurpose)
      ? "Users lack affordable, practical support for the outcome."
      : "Users struggle to stay consistent and get results.",
    targetUser: /african|diaspora/i.test(rawPurpose)
      ? "African users and diaspora communities"
      : "people who need this outcome",
    change: /health|fit|confiden|habit/i.test(rawPurpose)
      ? "Healthier routines, confidence, and consistency"
      : "Measurable improvement in the outcome they care about",
    value: `Culturally relevant, practical guidance.${goalHint}`,
    missing: [],
  };
}

export function generatePurposeOptionsDeterministic(
  rawPurpose: string,
  understanding: PurposeUnderstanding,
): string[] {
  return [
    `The purpose is to help ${understanding.targetUser} overcome ${understanding.problem.toLowerCase()} by providing structured support and accountability.`,
    `The purpose is to help ${understanding.targetUser} achieve ${understanding.change.toLowerCase()} through an experience designed for their lifestyle and resources.`,
    `The purpose is to serve an underserved segment by combining practical execution, community, and clear progress toward ${understanding.change.toLowerCase()}.`,
  ];
}

export async function refineGoal(rawGoal: string, ctx: { userId: string; blueprintId: string }) {
  const { interpretGoal } = await import("../bhudhi/BhudhiInterpretationEngine.js");
  const interpreted = await interpretGoal(rawGoal, ctx);
  const understanding: GoalUnderstanding = {
    object: interpreted.goal_extraction.object,
    domain: interpreted.goal_extraction.domain,
    impliedUser: interpreted.goal_extraction.intent,
    impliedOutcome: interpreted.goal_extraction.outcome,
    unclear: interpreted.gaps.map((g) => g.replace(/_/g, " ")),
  };
  const options = interpreted.refinement_options.map((o) => o.option);
  return { understanding, options, interpretation: interpreted };
}

export async function refinePurpose(
  rawPurpose: string,
  ctx: { userId: string; blueprintId: string; goalFinal?: string },
) {
  const { interpretPurpose } = await import("../bhudhi/BhudhiInterpretationEngine.js");
  const interpreted = await interpretPurpose(rawPurpose, {
    goalContext: ctx.goalFinal,
    userId: ctx.userId,
    blueprintId: ctx.blueprintId,
  });
  const understanding: PurposeUnderstanding = {
    problem: interpreted.purpose_extraction.problem,
    targetUser: interpreted.purpose_extraction.target_user,
    change: interpreted.purpose_extraction.change,
    value: interpreted.purpose_extraction.value.join(", "),
    missing: interpreted.pain_points_addressed,
  };
  const options = interpreted.refinement_options.map((o) => o.option);
  return { understanding, options, interpretation: interpreted };
}
