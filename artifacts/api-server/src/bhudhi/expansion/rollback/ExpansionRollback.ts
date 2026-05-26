import { updateCapabilityStatus } from "../expansionData.js";

export interface RollbackResult {
  success: boolean;
  capabilityId: string;
  previousStatus: string;
  message: string;
}

/** Reversible capability rollback — all promoted capabilities remain rollback-eligible. */
export class ExpansionRollback {
  async rollback(
    capabilityId: string,
    blueprintId: string,
    appliedBy = "system",
  ): Promise<RollbackResult> {
    await updateCapabilityStatus(capabilityId, "rolled_back", blueprintId, "capability_rollback", {
      appliedBy,
      reversible: true,
    });

    return {
      success: true,
      capabilityId,
      previousStatus: "promoted",
      message: "Capability rolled back — previous version retained in audit trail",
    };
  }
}

export const expansionRollback = new ExpansionRollback();
