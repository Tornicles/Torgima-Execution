import { and, eq, inArray } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorBlueprintLaunchContracts,
  erectorCorrectionPaths,
} from "@workspace/db";
import { getBlueprintErectorState } from "./erectorStateMachine.js";

export interface LaunchContractEnforcementResult {
  permitted: boolean;
  reason?: string;
  user_message?: string;
  contract_id?: string | null;
}

const LAUNCH_BLOCKING_CORRECTION_TYPES = [
  "VALIDATION_ADJUST",
  "PIVOT_REQUIRED",
  "ECONOMIC_MODEL_FAILURE",
  "PHASE_GATE_BLOCK",
] as const;

function launchBlockMessage(permission: string): string {
  switch (permission) {
    case "BLOCKED":
      return "Project launch is blocked until validation issues are resolved.";
    case "ADJUST":
    case "PROCEED":
      return "Complete simulation and path selection before launching your project.";
    default:
      return "Project validation is not complete.";
  }
}

export function isOnboardingBlueprint(blueprintSource: string | null | undefined): boolean {
  return (blueprintSource ?? "onboarding") === "onboarding";
}

export async function loadActiveLaunchContract(blueprintId: string) {
  const [contract] = await db
    .select()
    .from(erectorBlueprintLaunchContracts)
    .where(
      and(
        eq(erectorBlueprintLaunchContracts.blueprint_id, blueprintId),
        eq(erectorBlueprintLaunchContracts.consumed, false),
      ),
    )
    .limit(1);
  return contract ?? null;
}

export async function setLaunchContractPermitted(blueprintId: string): Promise<void> {
  await db
    .update(erectorBlueprintLaunchContracts)
    .set({ launch_permission: "PERMITTED" })
    .where(
      and(
        eq(erectorBlueprintLaunchContracts.blueprint_id, blueprintId),
        eq(erectorBlueprintLaunchContracts.consumed, false),
      ),
    );
}

export async function markContractConsumed(contractId: string): Promise<void> {
  await db
    .update(erectorBlueprintLaunchContracts)
    .set({ consumed: true, consumed_at: new Date() })
    .where(eq(erectorBlueprintLaunchContracts.id, contractId));
}

async function hasOpenCriticalCorrections(blueprintId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: erectorCorrectionPaths.id })
    .from(erectorCorrectionPaths)
    .where(
      and(
        eq(erectorCorrectionPaths.blueprint_id, blueprintId),
        inArray(erectorCorrectionPaths.status, ["open", "in_progress"]),
        inArray(erectorCorrectionPaths.correction_type, [...LAUNCH_BLOCKING_CORRECTION_TYPES]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function enforceLaunchContract(
  blueprintId: string,
  userId: string,
): Promise<LaunchContractEnforcementResult> {
  const [blueprint] = await db
    .select({
      blueprint_source: blueprints.blueprint_source,
      erector_intake_session_id: blueprints.erector_intake_session_id,
      erector_validation_id: blueprints.erector_validation_id,
    })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!blueprint) {
    return {
      permitted: false,
      reason: "NOT_FOUND",
      user_message: "Blueprint not found.",
    };
  }

  const contract = await loadActiveLaunchContract(blueprintId);

  if (
    isOnboardingBlueprint(blueprint.blueprint_source) &&
    !blueprint.erector_intake_session_id &&
    !blueprint.erector_validation_id
  ) {
    return { permitted: true, contract_id: null };
  }

  if (!contract) {
    return {
      permitted: false,
      reason: "NO_LAUNCH_CONTRACT",
      user_message: "Complete Project Intelligence before launching your project.",
    };
  }

  const permission = contract.launch_permission?.toUpperCase() ?? "";
  if (permission !== "PERMITTED") {
    return {
      permitted: false,
      reason: permission || "NOT_PERMITTED",
      user_message: launchBlockMessage(permission),
      contract_id: contract.id,
    };
  }

  const erectorState = await getBlueprintErectorState(blueprintId);
  if (erectorState !== "LAUNCH_PERMITTED") {
    return {
      permitted: false,
      reason: "INVALID_STATE",
      user_message: "Project validation is not complete.",
      contract_id: contract.id,
    };
  }

  if (await hasOpenCriticalCorrections(blueprintId)) {
    return {
      permitted: false,
      reason: "OPEN_CRITICAL_CORRECTION",
      user_message: "Resolve all critical issues before launching.",
      contract_id: contract.id,
    };
  }

  return { permitted: true, contract_id: contract.id };
}
