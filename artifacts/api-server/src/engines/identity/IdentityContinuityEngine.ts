/**
 * Phase 3 DOC 18 — canonical path (implementation in intelligence/).
 */
export {
  IdentityContinuityEngine,
  identityContinuityEngine,
  evaluateIdentity,
  getCurrentIdentityState,
  getIdentityHistory,
  getIdentityPanelData,
  isVerifiedFeedbackEvidence,
  toDashboardIdentity,
  DB_TO_IL1_STAGE,
  IL1_TO_DB_STAGE,
  type Il1IdentityStage,
  type DbIdentityStage,
} from "../intelligence/IdentityContinuityEngine.js";

export {
  calculateIdentityDimensions,
  type IdentityDimensionScores,
} from "./identityDimensions.js";
