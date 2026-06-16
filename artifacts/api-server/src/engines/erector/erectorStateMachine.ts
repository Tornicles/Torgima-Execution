import { eq } from "drizzle-orm";
import { db, blueprints, erectorSystemErrorRecords } from "@workspace/db";
import { EVENT_TYPES, writeEvent } from "../../services/EventService.js";

export type ErectorBlueprintState =
  | "not_started"
  | "INTAKE_STARTED"
  | "INTAKE_SUBMITTED"
  | "GOAL_STRUCTURED"
  | "VALIDATION_REQUESTED"
  | "VALIDATION_RUNNING"
  | "VERDICT_ISSUED"
  | "PATH_SELECTION_REQUIRED"
  | "CORRECTION_REQUIRED"
  | "REVALIDATION_RUNNING"
  | "PATH_SELECTED"
  | "SIMULATION_REQUIRED"
  | "SIMULATION_RUNNING"
  | "LAUNCH_BLOCKED"
  | "LAUNCH_PERMITTED"
  | "BLUEPRINT_ACTIVE"
  | "OUTCOME_VALIDATION_PENDING"
  | "OUTCOME_VALIDATED"
  | "FALSE_PROGRESS_ACTIVE"
  | "ADVANCEMENT_BLOCKED"
  | "ACADEMY_REQUIRED"
  | "ACADEMY_PROOF_PENDING"
  | "ACADEMY_COMPLETED"
  | "PHASE_GATE_REVIEW"
  | "PHASE_ADVANCED"
  | "PHASE_BLOCKED"
  | "SYSTEM_ERROR_BLOCKED";

export const VALID_TRANSITIONS: Record<ErectorBlueprintState, ErectorBlueprintState[]> = {
  not_started: ["INTAKE_STARTED"],
  INTAKE_STARTED: ["INTAKE_SUBMITTED", "not_started"],
  INTAKE_SUBMITTED: ["GOAL_STRUCTURED", "INTAKE_STARTED"],
  GOAL_STRUCTURED: ["VALIDATION_REQUESTED"],
  VALIDATION_REQUESTED: ["VALIDATION_RUNNING"],
  VALIDATION_RUNNING: ["VERDICT_ISSUED", "SYSTEM_ERROR_BLOCKED"],
  VERDICT_ISSUED: ["PATH_SELECTION_REQUIRED", "CORRECTION_REQUIRED"],
  PATH_SELECTION_REQUIRED: ["PATH_SELECTED", "CORRECTION_REQUIRED"],
  CORRECTION_REQUIRED: ["REVALIDATION_RUNNING", "INTAKE_STARTED"],
  REVALIDATION_RUNNING: ["VERDICT_ISSUED", "SYSTEM_ERROR_BLOCKED"],
  PATH_SELECTED: ["SIMULATION_REQUIRED", "LAUNCH_PERMITTED"],
  SIMULATION_REQUIRED: ["SIMULATION_RUNNING"],
  SIMULATION_RUNNING: ["LAUNCH_PERMITTED", "LAUNCH_BLOCKED", "SYSTEM_ERROR_BLOCKED"],
  LAUNCH_PERMITTED: ["BLUEPRINT_ACTIVE"],
  LAUNCH_BLOCKED: ["REVALIDATION_RUNNING", "CORRECTION_REQUIRED"],
  BLUEPRINT_ACTIVE: ["OUTCOME_VALIDATION_PENDING", "ACADEMY_REQUIRED", "PHASE_GATE_REVIEW"],
  OUTCOME_VALIDATION_PENDING: [
    "OUTCOME_VALIDATED",
    "ADVANCEMENT_BLOCKED",
    "FALSE_PROGRESS_ACTIVE",
  ],
  OUTCOME_VALIDATED: ["BLUEPRINT_ACTIVE", "PHASE_GATE_REVIEW"],
  FALSE_PROGRESS_ACTIVE: ["BLUEPRINT_ACTIVE", "ADVANCEMENT_BLOCKED"],
  ADVANCEMENT_BLOCKED: ["BLUEPRINT_ACTIVE"],
  ACADEMY_REQUIRED: ["ACADEMY_PROOF_PENDING"],
  ACADEMY_PROOF_PENDING: ["ACADEMY_COMPLETED", "ACADEMY_REQUIRED"],
  ACADEMY_COMPLETED: ["BLUEPRINT_ACTIVE"],
  PHASE_GATE_REVIEW: ["PHASE_ADVANCED", "PHASE_BLOCKED"],
  PHASE_ADVANCED: ["BLUEPRINT_ACTIVE"],
  PHASE_BLOCKED: ["BLUEPRINT_ACTIVE", "CORRECTION_REQUIRED"],
  SYSTEM_ERROR_BLOCKED: ["VALIDATION_REQUESTED", "SIMULATION_REQUIRED"],
};

function normalizeState(value: string | null | undefined): ErectorBlueprintState {
  const normalized = (value ?? "not_started") as ErectorBlueprintState;
  if (normalized in VALID_TRANSITIONS) return normalized;
  return "not_started";
}

export async function getBlueprintErectorState(
  blueprintId: string,
): Promise<ErectorBlueprintState> {
  const [row] = await db
    .select({ erector_state: blueprints.erector_state })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return normalizeState(row?.erector_state);
}

async function writeSystemError(input: {
  error_type: string;
  source_engine: string;
  blueprint_id: string;
  user_id?: string;
  error_message: string;
  error_detail?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(erectorSystemErrorRecords).values({
    error_type: input.error_type,
    source_engine: input.source_engine,
    blueprint_id: input.blueprint_id,
    user_id: input.user_id ?? null,
    error_message: input.error_message,
    error_detail: input.error_detail ?? {},
  });
}

export async function updateBlueprintErectorState(
  blueprintId: string | null | undefined,
  state: ErectorBlueprintState,
): Promise<void> {
  if (!blueprintId) return;
  await db.update(blueprints).set({ erector_state: state }).where(eq(blueprints.id, blueprintId));
}

export async function transition(
  blueprintId: string,
  userId: string,
  toState: ErectorBlueprintState,
  triggeredBy: string,
): Promise<{ success: boolean; error?: string }> {
  const currentState = await getBlueprintErectorState(blueprintId);
  const validNextStates = VALID_TRANSITIONS[currentState] ?? [];

  if (!validNextStates.includes(toState)) {
    await writeSystemError({
      error_type: "STATE_TRANSITION_FAILED",
      source_engine: "ErectorStateMachine",
      blueprint_id: blueprintId,
      user_id: userId,
      error_message: `Invalid transition: ${currentState} → ${toState}`,
      error_detail: { from_state: currentState, to_state: toState, triggered_by: triggeredBy },
    });

    return {
      success: false,
      error: `Cannot transition from ${currentState} to ${toState}`,
    };
  }

  await updateBlueprintErectorState(blueprintId, toState);

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_STATE_CHANGED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: {
      from_state: currentState,
      to_state: toState,
      triggered_by: triggeredBy,
    },
    idempotencyKey: `erector_state_changed:${blueprintId}:${currentState}:${toState}:${triggeredBy}`,
  }).catch(() => null);

  return { success: true };
}

export const ErectorStateMachine = {
  getBlueprintErectorState,
  transition,
  updateBlueprintErectorState,
  VALID_TRANSITIONS,
};
