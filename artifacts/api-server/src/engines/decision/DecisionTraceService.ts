/**
 * DOC23 Task 1 — decision trace recording and memory retrieval.
 */

import { db, decisionTraces } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import {
  DOC23_DECISION_TYPES,
  type DecisionTraceWriteInput,
  type Doc23DecisionType,
} from "./decisionTypes.js";

export class DecisionTraceService {
  static isValidDecisionType(type: string): type is Doc23DecisionType {
    return (DOC23_DECISION_TYPES as readonly string[]).includes(type);
  }

  static async write(input: DecisionTraceWriteInput): Promise<string> {
    if (!DecisionTraceService.isValidDecisionType(input.decisionType)) {
      throw new Error("INVALID_DECISION_TYPE");
    }
    if (!input.decisionKey || !input.selectedOption) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }

    const [row] = await db
      .insert(decisionTraces)
      .values({
        user_id: input.userId,
        blueprint_id: input.blueprintId,
        decision_type: input.decisionType,
        entity_type: input.sourceEngine,
        entity_id: input.causationEventId ?? undefined,
        reasoning: input.rationaleSummary,
        input_summary: input.decisionKey,
        output_summary: input.selectedOption,
        alternatives_considered: input.optionsConsidered,
        state_version: input.stateVersion,
        engine: input.sourceEngine,
        engine_source: input.sourceEngine,
        inputs_json: {
          decision_key: input.decisionKey,
          selected_option: input.selectedOption,
          options_considered: input.optionsConsidered,
          rejected_options: input.rejectedOptions ?? [],
          evidence_ids: input.evidenceIds ?? [],
          order_id: input.orderId,
          confidence: input.confidence ?? "MEDIUM",
          causation_event_id: input.causationEventId,
        },
        outputs_json: {
          outcome: input.selectedOption,
          output_summary: input.selectedOption,
          confidence: input.confidence ?? "MEDIUM",
        },
      })
      .returning({ id: decisionTraces.id });

    if (!row) throw new Error("Failed to write decision trace");

    const addsChoices =
      input.optionsConsidered.length > 1 && !input.selectedOption;
    if (addsChoices) {
      await writeEvent({
        eventType: EVENT_TYPES.COGNITIVE_LOAD_EVALUATION_REQUESTED,
        entityType: "user",
        entityId: input.userId,
        userId: input.userId,
        blueprintId: input.blueprintId,
        payload: { reason: "new_unresolved_decision", decision_key: input.decisionKey },
        idempotencyKey: `cognitive_load_eval:${input.decisionKey}`,
      }).catch(() => null);
    }

    return row.id;
  }

  static async loadRecent(
    userId: string,
    blueprintId: string,
    limit = 5,
  ): Promise<(typeof decisionTraces.$inferSelect)[]> {
    return db
      .select()
      .from(decisionTraces)
      .where(and(eq(decisionTraces.user_id, userId), eq(decisionTraces.blueprint_id, blueprintId)))
      .orderBy(desc(decisionTraces.created_at))
      .limit(limit);
  }
}

export async function writeEngineDecision(input: DecisionTraceWriteInput): Promise<string> {
  return DecisionTraceService.write(input);
}

export { DOC23_DECISION_TYPES, type DecisionTraceWriteInput, type Doc23DecisionType };
