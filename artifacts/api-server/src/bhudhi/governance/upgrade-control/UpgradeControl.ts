import type { GovernanceAction, ApprovalLevel } from "../contracts/types.js";

/** System upgrades and policy changes require L5 human lock */
export class UpgradeControl {
  requiresHumanLock(action: GovernanceAction): boolean {
    return action === "MODIFY_POLICIES" || action === "DEPLOY_SYSTEM" || action === "SELF_DEPLOY";
  }

  minimumApprovalLevel(action: GovernanceAction): ApprovalLevel {
    if (this.requiresHumanLock(action)) return "L5";
    if (action === "LEARNING_UPDATE") return "L3";
    return "L2";
  }

  canAutoUpgrade(_version: string): boolean {
    return false;
  }
}

export const upgradeControl = new UpgradeControl();
