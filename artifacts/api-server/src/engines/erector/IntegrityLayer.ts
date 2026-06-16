import { randomBytes } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  db,
  erectorEvidenceLedger,
  erectorIntegrityFlags,
  erectorManualReviewCases,
} from "@workspace/db";
import type {
  EvidenceClass,
  EvidenceRecord,
  EvidenceStrength,
  IntegrityFlag,
} from "../../services/erector/evidence/types.js";
import type { SubmitEvidenceInput } from "../../services/erector/evidence/types.js";

export type IntegrityAction = "evidence_accepted" | "evidence_rejected";

export interface IntegrityEvaluationResult {
  flags: string[];
  confidence_impact: number;
  action: IntegrityAction;
  manual_review_triggered?: boolean;
}

const STRENGTH_ORDER: EvidenceStrength[] = [
  "HIGH",
  "MEDIUM-HIGH",
  "MEDIUM",
  "LOW-MEDIUM",
  "LOW",
  "NONE",
];

function hasArtifactOrExternal(input: SubmitEvidenceInput): boolean {
  if (input.sourceType === "external_confirmation" || input.sourceType === "payment_signal") {
    return true;
  }
  const json = input.contentJson;
  return Boolean(
    json.file_id ||
      json.fileId ||
      json.output_url ||
      json.verification_url ||
      json.source_url,
  );
}

function summaryClaimsPayment(summary: string | undefined): boolean {
  if (!summary) return false;
  return /\b(sale|sold|payment|paid|revenue|invoice)\b/i.test(summary);
}

function summaryClaimsOutcome(summary: string | undefined, evidenceClass: EvidenceClass): boolean {
  if (!summary?.trim()) return false;
  if (evidenceClass === "PAYMENT_PROOF") return true;
  return summaryClaimsPayment(summary);
}

export function applyConfidenceImpact(
  strength: EvidenceStrength,
  impact: number,
): EvidenceStrength {
  if (impact >= 0 || strength === "NONE") return strength;
  const steps = Math.max(1, Math.round(Math.abs(impact) * 5));
  const idx = STRENGTH_ORDER.indexOf(strength);
  const next = Math.min(STRENGTH_ORDER.length - 1, idx + steps);
  return STRENGTH_ORDER[next] ?? "NONE";
}

async function loadRecentEvidence(userId: string, blueprintId?: string): Promise<EvidenceRecord[]> {
  const conditions = [
    eq(erectorEvidenceLedger.user_id, userId),
    gte(erectorEvidenceLedger.created_at, new Date(Date.now() - 14 * 86400000)),
  ];
  if (blueprintId) {
    conditions.push(eq(erectorEvidenceLedger.blueprint_id, blueprintId));
  }
  return db.select().from(erectorEvidenceLedger).where(and(...conditions));
}

async function writeIntegrityFlags(
  userId: string,
  blueprintId: string | undefined,
  evidenceId: string | null,
  flags: string[],
  confidenceImpact: number,
): Promise<void> {
  for (const flag of flags) {
    await db.insert(erectorIntegrityFlags).values({
      user_id: userId,
      blueprint_id: blueprintId ?? null,
      evidence_id: evidenceId,
      flag_type: flag,
      severity:
        flag === "BYPASS_ATTEMPT" || flag === "DUPLICATE_PROOF"
          ? "HIGH"
          : flag === "SUSPICIOUS_METRIC"
            ? "MEDIUM"
            : "LOW",
      detection_reason: `IntegrityLayer detected ${flag}`,
      confidence_impact: String(confidenceImpact.toFixed(2)),
      status: "open",
    });
  }
}

async function triggerManualReviewIfRepeated(
  userId: string,
  blueprintId: string | undefined,
  flagIds: string[],
): Promise<boolean> {
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(erectorIntegrityFlags)
    .where(
      and(
        eq(erectorIntegrityFlags.user_id, userId),
        eq(erectorIntegrityFlags.flag_type, "BYPASS_ATTEMPT"),
        gte(erectorIntegrityFlags.created_at, new Date(Date.now() - 30 * 86400000)),
      ),
    );

  if ((recent?.count ?? 0) < 2) return false;

  const caseId = `MR-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  await db.insert(erectorManualReviewCases).values({
    case_id: caseId,
    user_id: userId,
    blueprint_id: blueprintId ?? null,
    trigger_type: "BYPASS_ATTEMPT",
    trigger_description: "Repeated bypass attempts detected on evidence submissions",
    integrity_flag_ids: flagIds,
    risk_level: "HIGH",
    status: "open",
  });
  return true;
}

export class IntegrityLayer {
  async evaluate(
    userId: string,
    blueprintId: string | undefined,
    submission: SubmitEvidenceInput & { evidence_class: EvidenceClass },
    existingEvidence: EvidenceRecord[],
  ): Promise<IntegrityEvaluationResult> {
    const flags: string[] = [];
    let confidenceImpact = 0;

    const summaryLen = submission.contentSummary?.trim().length ?? 0;
    if (
      submission.evidence_class === "USER_EXPLANATION" &&
      summaryLen < 100 &&
      !hasArtifactOrExternal(submission)
    ) {
      flags.push("SELF_REPORT_ONLY");
      confidenceImpact -= 0.2;
    }

    if (submission.sourceLocation) {
      const duplicate = existingEvidence.some(
        (row) =>
          row.source_location === submission.sourceLocation &&
          row.validation_status !== "rejected" &&
          row.created_at.getTime() > Date.now() - 7 * 86400000,
      );
      if (duplicate) {
        flags.push("DUPLICATE_PROOF");
        return {
          flags,
          confidence_impact: -0.3,
          action: "evidence_rejected",
        };
      }
    }

    const metricValue = Number(
      submission.contentJson.metric_value ?? submission.contentJson.value ?? submission.contentJson.claimed,
    );
    const expectedMax = Number(
      submission.contentJson.expected_max ?? submission.contentJson.baseline ?? 0,
    );
    if (
      submission.evidence_class === "ANALYTICS_MOVEMENT" &&
      Number.isFinite(metricValue) &&
      Number.isFinite(expectedMax) &&
      expectedMax > 0 &&
      metricValue > expectedMax * 3
    ) {
      flags.push("SUSPICIOUS_METRIC");
      confidenceImpact -= 0.25;
    }

    const metricName = String(submission.contentJson.metric_name ?? submission.contentJson.metric ?? "");
    if (
      submission.evidence_class === "ANALYTICS_MOVEMENT" &&
      metricName &&
      !submission.contentJson.target_metric_name &&
      !submission.outcomeId
    ) {
      flags.push("VANITY_METRIC");
      confidenceImpact -= 0.15;
    }

    const taskCompletionCount = existingEvidence.filter(
      (row) =>
        row.evidence_class === "TASK_COMPLETION_COUNT" &&
        row.created_at.getTime() > Date.now() - 14 * 86400000,
    ).length;
    const hasVerified = existingEvidence.some(
      (row) => row.evidence_strength === "HIGH" || row.validation_status === "validated",
    );
    if (taskCompletionCount >= 5 && !hasVerified) {
      flags.push("REPEATED_LOW_VALUE_COMPLETION");
      confidenceImpact -= 0.2;
    }

    if (
      summaryClaimsOutcome(submission.contentSummary, submission.evidence_class) &&
      submission.sourceType === "user_upload" &&
      submission.evidence_class !== "PAYMENT_PROOF" &&
      !hasArtifactOrExternal(submission)
    ) {
      flags.push("CLAIM_EVIDENCE_MISMATCH");
      confidenceImpact -= 0.15;
    }

    const intentionCount = existingEvidence.filter(
      (row) => row.evidence_class === "INTENTION_OR_PLAN",
    ).length;
    if (submission.evidence_class === "INTENTION_OR_PLAN" && intentionCount >= 2) {
      flags.push("BYPASS_ATTEMPT");
      confidenceImpact -= 0.5;
    }

    let manualReviewTriggered = false;
    if (flags.includes("BYPASS_ATTEMPT")) {
      manualReviewTriggered = await triggerManualReviewIfRepeated(userId, blueprintId, flags);
    }

    if (flags.length > 0) {
      await writeIntegrityFlags(userId, blueprintId, null, flags, confidenceImpact);
    }

    return {
      flags,
      confidence_impact: confidenceImpact,
      action: "evidence_accepted",
      manual_review_triggered: manualReviewTriggered,
    };
  }

  async loadContext(userId: string, blueprintId?: string): Promise<EvidenceRecord[]> {
    return loadRecentEvidence(userId, blueprintId);
  }
}

export const integrityLayer = new IntegrityLayer();

export function mergeIntegrityFlags(
  scoredFlags: IntegrityFlag[],
  layerFlags: string[],
): IntegrityFlag[] {
  const merged = new Set<string>([...scoredFlags, ...layerFlags]);
  return [...merged] as IntegrityFlag[];
}
