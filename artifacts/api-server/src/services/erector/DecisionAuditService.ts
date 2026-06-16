import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  erectorDecisionAudits,
  erectorUserFacingExplanations,
} from "@workspace/db";
import { ERECTOR_EVENTS } from "../../lib/erector-event-types.js";
import { redactAuditSnapshot } from "./PrivacySecurityLayer.js";
import { EVENT_TYPES, writeEvent } from "../EventService.js";
import { ModelVersioningService } from "./ModelVersioningService.js";

export interface DecisionAuditWriteInput {
  decisionType: string;
  sourceEngine: string;
  userId: string;
  blueprintId?: string;
  entityType: string;
  entityId: string;
  inputSnapshot: Record<string, unknown>;
  evidenceIds?: string[];
  signalIds?: string[];
  rulesApplied?: string[];
  frameworkVerdicts?: unknown[];
  result: string;
  resultDetail?: Record<string, unknown>;
  explanationId?: string;
  downstreamEffects?: string[];
  userVisible?: boolean;
}

export interface DecisionAuditRecord {
  decision_id: string;
  decision_type: string;
  source_engine: string;
  user_id: string;
  blueprint_id: string | null;
  entity_type: string;
  entity_id: string;
  input_snapshot: Record<string, unknown>;
  evidence_ids: string[];
  signal_ids: string[];
  rules_applied: string[];
  framework_verdicts: unknown[];
  model_versions: Record<string, string>;
  result: string;
  result_detail: Record<string, unknown>;
  explanation_id: string | null;
  downstream_effects: string[];
  user_visible: boolean;
  created_at: Date;
  user_facing_summary?: string | null;
  plain_language_reason?: string | null;
}

function generateDecisionId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `DA-${stamp}-${suffix}`;
}

export class DecisionAuditService {
  async write(input: DecisionAuditWriteInput): Promise<string> {
    const decisionId = generateDecisionId();
    const modelVersions = await ModelVersioningService.getCurrentVersions();

    await db.insert(erectorDecisionAudits).values({
      decision_id: decisionId,
      decision_type: input.decisionType,
      source_engine: input.sourceEngine,
      user_id: input.userId,
      blueprint_id: input.blueprintId ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId,
      input_snapshot: redactAuditSnapshot(input.inputSnapshot),
      evidence_ids: input.evidenceIds ?? [],
      signal_ids: input.signalIds ?? [],
      rules_applied: input.rulesApplied ?? [],
      framework_verdicts: input.frameworkVerdicts ?? [],
      model_versions: modelVersions,
      result: input.result,
      result_detail: input.resultDetail ?? {},
      explanation_id: input.explanationId ?? null,
      downstream_effects: input.downstreamEffects ?? [],
      user_visible: input.userVisible ?? false,
    });

    void writeEvent({
      eventType: EVENT_TYPES.ERECTOR_AUDIT_RECORD_CREATED,
      entityType: "erector_decision_audit",
      entityId: decisionId,
      userId: input.userId,
      blueprintId: input.blueprintId,
      payload: {
        decision_id: decisionId,
        decision_type: input.decisionType,
        source_engine: input.sourceEngine,
        entity_type: input.entityType,
        entity_id: input.entityId,
        result: input.result,
        event_name: ERECTOR_EVENTS.AUDIT_RECORD_CREATED,
      },
      idempotencyKey: `erector_audit_record_created:${decisionId}`,
    }).catch(() => undefined);

    return decisionId;
  }

  async getByDecisionId(decisionId: string, userId: string): Promise<DecisionAuditRecord | null> {
    const [row] = await db
      .select()
      .from(erectorDecisionAudits)
      .where(
        and(
          eq(erectorDecisionAudits.decision_id, decisionId),
          eq(erectorDecisionAudits.user_id, userId),
        ),
      )
      .limit(1);

    if (!row) return null;

    let explanation: { user_facing_summary: string; plain_language_reason: string } | null = null;
    if (row.user_visible && row.explanation_id) {
      const [exp] = await db
        .select({
          user_facing_summary: erectorUserFacingExplanations.user_facing_summary,
          plain_language_reason: erectorUserFacingExplanations.plain_language_reason,
        })
        .from(erectorUserFacingExplanations)
        .where(eq(erectorUserFacingExplanations.id, row.explanation_id))
        .limit(1);
      explanation = exp ?? null;
    }

    return {
      ...row,
      input_snapshot: (row.input_snapshot ?? {}) as Record<string, unknown>,
      model_versions: (row.model_versions ?? {}) as Record<string, string>,
      result_detail: (row.result_detail ?? {}) as Record<string, unknown>,
      framework_verdicts: (row.framework_verdicts ?? []) as unknown[],
      user_facing_summary: explanation?.user_facing_summary ?? null,
      plain_language_reason: explanation?.plain_language_reason ?? null,
    };
  }

  async getByBlueprint(blueprintId: string, userId: string): Promise<DecisionAuditRecord[]> {
    const rows = await db
      .select()
      .from(erectorDecisionAudits)
      .where(
        and(
          eq(erectorDecisionAudits.blueprint_id, blueprintId),
          eq(erectorDecisionAudits.user_id, userId),
        ),
      )
      .orderBy(desc(erectorDecisionAudits.created_at));

    return rows.map((row) => ({
      ...row,
      input_snapshot: (row.input_snapshot ?? {}) as Record<string, unknown>,
      model_versions: (row.model_versions ?? {}) as Record<string, string>,
      result_detail: (row.result_detail ?? {}) as Record<string, unknown>,
      framework_verdicts: (row.framework_verdicts ?? []) as unknown[],
      user_facing_summary: null,
      plain_language_reason: null,
    }));
  }
}

export const decisionAuditService = new DecisionAuditService();
