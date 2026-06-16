/**
 * Execution-loop entry — DOC 11 inactivity detection + Phase 1 scan exports.
 */
export {
  detectInactivity,
  getOpenInactivityRecord,
  severityFromHoursInactive,
  classifyInactivityReason,
  selectRecoveryPath,
  Doc11InactivityDetectionEngine,
  type DetectInactivityResult,
  type Doc11InactivityType,
  type Doc11InactivitySeverity,
} from "./inactivity/InactivityDetectionCore.js";

export {
  InactivityDetectionEngine,
  scanForInactivity,
  scanAll,
  getLastInactivityScanAt,
  getCurrentInactivityForBlueprint,
  isBlueprintEligibleForInactivityScan,
  type CurrentInactivitySnapshot,
} from "../inactivity/InactivityDetectionEngine.js";
