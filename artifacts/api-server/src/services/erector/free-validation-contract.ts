/**
 * Prompt 7 — Free Erector public validation contract, language map, and rate-limit helpers.
 */
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { db, erectorFreeValidations } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import type { ErectorFreeOutput } from "../../bhudhi/schemas/erector-schemas.js";
import { ErectorFreeOutputSchema } from "../../bhudhi/schemas/erector-schemas.js";

export const FREE_VALIDATION_LIMIT = 3;
export const FREE_VALIDATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const IP_VALIDATION_LIMIT = 10;
export const SESSION_VALIDATION_LIMIT = 3;

const SPAM_PATTERNS = [/(.)\1{8,}/i, /^(test|asdf|xxx|spam|none|n\/a)+$/i];

const budgetEnum = z.enum(["under_1k", "1k_5k", "5k_20k", "20k_plus"]);
const timelineEnum = z.enum(["1_month", "3_months", "6_months", "12_months_plus"]);

const rawFreeBodySchema = z
  .object({
    idea_or_goal: z.string().trim().max(500).optional(),
    industry_or_domain: z.string().trim().max(200).optional(),
    industry: z.string().trim().max(200).optional(),
    location: z.string().trim().min(1).max(120),
    budget_range: z.union([budgetEnum, z.string().trim().min(1).max(80)]),
    timeline: z.union([timelineEnum, z.string().trim().min(1).max(80)]),
    additional_context: z.string().max(500).optional(),
    optional_context: z.string().max(500).optional(),
    fingerprint: z.string().trim().min(8).max(128).optional(),
    anonymous_session_id: z.string().trim().min(8).max(128).optional(),
  })
  .superRefine((data, ctx) => {
    const idea = data.idea_or_goal?.trim();
    const industryDomain = (data.industry_or_domain ?? data.industry)?.trim();
    if (!industryDomain) {
      ctx.addIssue({
        code: "custom",
        message: "Industry or domain is required.",
        path: ["industry_or_domain"],
      });
    }
    if (!idea && !industryDomain) {
      ctx.addIssue({
        code: "custom",
        message: "Describe your idea or goal.",
        path: ["idea_or_goal"],
      });
    }
    const goalText = idea ?? industryDomain ?? "";
    if (goalText.length < 10) {
      ctx.addIssue({
        code: "custom",
        message: "Please describe your idea in a bit more detail (at least 10 characters).",
        path: ["idea_or_goal"],
      });
    }
    if (SPAM_PATTERNS.some((re) => re.test(goalText))) {
      ctx.addIssue({
        code: "custom",
        message: "Please enter a meaningful description of your idea.",
        path: ["idea_or_goal"],
      });
    }
  });

export type NormalizedFreeValidateInput = {
  idea_or_goal: string;
  industry_or_domain: string;
  location: string;
  budget_range: string;
  timeline: string;
  additional_context?: string;
  fingerprint: string;
  anonymous_session_id: string;
};

export function parseFreeValidateBody(body: unknown): {
  ok: true;
  data: NormalizedFreeValidateInput;
} | {
  ok: false;
  fieldErrors: Record<string, string[]>;
} {
  const parsed = rawFreeBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const row = parsed.data;
  const industryDomain = (row.industry_or_domain ?? row.industry ?? "").trim();
  const idea =
    row.idea_or_goal?.trim() ||
    [industryDomain, row.additional_context?.trim(), row.optional_context?.trim()]
      .filter(Boolean)
      .join(" — ")
      .trim();

  const fingerprint = row.fingerprint?.trim() || row.anonymous_session_id?.trim() || randomUUID();
  const anonymous_session_id = row.anonymous_session_id?.trim() || fingerprint;

  return {
    ok: true,
    data: {
      idea_or_goal: sanitizeText(idea),
      industry_or_domain: sanitizeText(industryDomain),
      location: sanitizeText(row.location.trim()),
      budget_range: typeof row.budget_range === "string" ? row.budget_range.trim() : row.budget_range,
      timeline: typeof row.timeline === "string" ? row.timeline.trim() : row.timeline,
      additional_context: sanitizeText(row.additional_context ?? row.optional_context ?? ""),
      fingerprint,
      anonymous_session_id,
    },
  };
}

export function sanitizeText(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

export function hashIpAddress(ip: string | undefined): string | null {
  if (!ip?.trim()) return null;
  return createHash("sha256").update(ip.trim()).digest("hex");
}

function windowStart(): Date {
  return new Date(Date.now() - FREE_VALIDATION_WINDOW_MS);
}

export async function countFreeValidationsByFingerprint(fingerprint: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(erectorFreeValidations)
    .where(
      and(
        eq(erectorFreeValidations.fingerprint, fingerprint),
        gte(erectorFreeValidations.created_at, windowStart()),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function countFreeValidationsByIpHash(ipHash: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(erectorFreeValidations)
    .where(
      and(
        eq(erectorFreeValidations.ip_address, ipHash),
        gte(erectorFreeValidations.created_at, windowStart()),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function countFreeValidationsBySession(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(erectorFreeValidations)
    .where(
      and(
        sql`${erectorFreeValidations.report_json}->'_meta'->>'anonymous_session_id' = ${sessionId}`,
        gte(erectorFreeValidations.created_at, windowStart()),
      ),
    );
  return Number(row?.count ?? 0);
}

export type FreeErectorPath = {
  path_name: string;
  what_it_means: string;
  likely_outcome: string;
  main_risk: string;
};

export type FreeErectorValidationResult = {
  validation_id: string;
  is_free_tier_preview: true;
  title: string;
  summary: string;
  score: number;
  score_label: string;
  verdict_label: string;
  recommended_direction: string;
  current_path: FreeErectorPath;
  adjusted_path: FreeErectorPath;
  alternative_path: FreeErectorPath;
  top_risks: string[];
  top_opportunities: string[];
  market_snapshot: string;
  execution_snapshot: string;
  next_steps: string[];
  upgrade_reasons: string[];
  handoff_token?: string;
  handoff_expires_at?: string;
  remaining_free_validations: number;
  upgrade_url: string;
  fallback_used?: boolean;
  report: ErectorFreeOutput;
};

const INTERNAL_VERDICT_MAP: Record<string, string> = {
  proceed: "Strong direction",
  PROCEED: "Strong direction",
  adjust: "Needs adjustment",
  ADJUST: "Needs adjustment",
  pivot: "Consider a different angle",
  PIVOT: "Consider a different angle",
  delay: "Wait or gather proof",
  DELAY: "Wait or gather proof",
  test_first: "Test before building",
  TEST_FIRST: "Test before building",
  blocked: "High risk",
  BLOCKED: "High risk",
};

export function mapVerdictToCustomerLabel(verdict: string | null | undefined): string {
  if (!verdict?.trim()) return "Not enough information";
  const key = verdict.trim();
  return INTERNAL_VERDICT_MAP[key] ?? INTERNAL_VERDICT_MAP[key.toLowerCase()] ?? "Not enough information";
}

export function mapScoreToLabel(score: number): string {
  if (score >= 75) return "Strong early fit";
  if (score >= 60) return "Promising with gaps";
  if (score >= 45) return "Mixed signals";
  if (score >= 30) return "High uncertainty";
  return "Needs more clarity";
}

function ensureRisks(risks: string[], fallback: string): string[] {
  const items = risks.filter((r) => r.trim()).slice(0, 5);
  while (items.length < 3) {
    items.push(fallback);
  }
  return items.slice(0, 5);
}

function ensureOpportunities(strengths: string[], direction: string): string[] {
  const items = [...strengths.filter((s) => s.trim())];
  if (direction.trim()) items.push(`Focus angle: ${direction.trim()}`);
  while (items.length < 3) {
    items.push("Run a small proof test before scaling spend.");
  }
  return items.slice(0, 5);
}

function buildPath(
  pathName: string,
  whatItMeans: string,
  likelyOutcome: string,
  mainRisk: string,
): FreeErectorPath {
  return { path_name: pathName, what_it_means: whatItMeans, likely_outcome: likelyOutcome, main_risk: mainRisk };
}

export function buildFreeValidationResult(args: {
  validationId: string;
  input: NormalizedFreeValidateInput;
  bhudhi: ErectorFreeOutput;
  remainingFree: number;
  handoffToken?: string;
  handoffExpiresAt?: string;
  fallbackUsed?: boolean;
}): FreeErectorValidationResult {
  const { input, bhudhi, validationId, remainingFree, handoffToken, handoffExpiresAt, fallbackUsed } =
    args;
  const verdictLabel = mapVerdictToCustomerLabel(bhudhi.verdict);
  const score = bhudhi.validation_score;
  const upgradeUrl = handoffToken ? `/upgrade?handoff=${handoffToken}` : "/upgrade";

  const topRisks = ensureRisks(
    bhudhi.top_risks,
    "Demand has not been validated with real customers yet.",
  );
  const topOpportunities = ensureOpportunities(bhudhi.top_strengths, bhudhi.primary_direction);

  return {
    validation_id: validationId,
    is_free_tier_preview: true,
    title: "Your free validation is ready.",
    summary:
      bhudhi.section_recommendation ||
      "This is a fast reality check based on your idea, market context, and constraints — not a full execution plan.",
    score,
    score_label: mapScoreToLabel(score),
    verdict_label: verdictLabel,
    recommended_direction: bhudhi.section_best_direction || bhudhi.primary_direction,
    current_path: buildPath(
      "Current path",
      `Pursue the idea as stated: ${input.idea_or_goal}`,
      "May work if demand is stronger than visible from a quick check.",
      topRisks[0] ?? "Unvalidated demand",
    ),
    adjusted_path: buildPath(
      "Adjusted path",
      bhudhi.primary_direction,
      "Higher chance of early traction with a narrower wedge.",
      topRisks[1] ?? bhudhi.failure_warnings[0] ?? "Execution scope may be too wide",
    ),
    alternative_path: buildPath(
      "Alternative path",
      bhudhi.alternative_direction || bhudhi.section_alternative_direction || "Test a smaller offer first.",
      "Lower risk proof before committing full budget.",
      topRisks[2] ?? "Timeline or budget pressure",
    ),
    top_risks: topRisks,
    top_opportunities: topOpportunities,
    market_snapshot: bhudhi.section_market_reality,
    execution_snapshot: bhudhi.section_execution_reality,
    next_steps: [
      "Clarify the target user and the one problem you solve first.",
      "Test the strongest angle with a small offer or conversation sprint.",
      "Upgrade to build the full execution Blueprint with Project Intelligence Intake.",
    ],
    upgrade_reasons: [
      "Full market and competitor intelligence",
      "Blueprint-linked execution tasks and signals",
      "Ongoing reality checks as you build",
    ],
    handoff_token: handoffToken,
    handoff_expires_at: handoffExpiresAt,
    remaining_free_validations: remainingFree,
    upgrade_url: upgradeUrl,
    fallback_used: fallbackUsed,
    report: bhudhi,
  };
}

export function wrapStoredReport(
  bhudhi: ErectorFreeOutput,
  input: NormalizedFreeValidateInput,
  meta: { ip_hash: string | null; anonymous_session_id: string },
): Record<string, unknown> {
  return {
    ...bhudhi,
    _meta: {
      anonymous_session_id: meta.anonymous_session_id,
      ip_hash: meta.ip_hash,
      original_input: {
        idea_or_goal: input.idea_or_goal,
        industry_or_domain: input.industry_or_domain,
        location: input.location,
        budget_range: input.budget_range,
        timeline: input.timeline,
        additional_context: input.additional_context ?? "",
        created_at: new Date().toISOString(),
      },
    },
  };
}

export function readOriginalInputFromReport(
  report: unknown,
): Record<string, unknown> | null {
  if (!report || typeof report !== "object") return null;
  const meta = (report as Record<string, unknown>)._meta;
  if (!meta || typeof meta !== "object") return null;
  const original = (meta as Record<string, unknown>).original_input;
  return original && typeof original === "object" ? (original as Record<string, unknown>) : null;
}

export function parseBhudhiFreeOutput(data: unknown): ErectorFreeOutput | null {
  const parsed = ErectorFreeOutputSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** @deprecated use parseFreeValidateBody — kept for tests importing schema name */
export const erectorFreeValidateBodySchema = rawFreeBodySchema;
