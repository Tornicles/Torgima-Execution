/**
 * Phase 3 DOC 18 — identity continuity facade.
 */
export {
  IdentityContinuityEngine,
  identityContinuityEngine,
  evaluateIdentity,
  evaluateIdentityStage,
  getCurrentIdentityState,
  getIdentityHistory,
  getIdentityPanelData,
  isVerifiedFeedbackEvidence,
  toDashboardIdentity,
  DB_TO_IL1_STAGE,
  IL1_TO_DB_STAGE,
  calculateStage,
  calculateRegressionRisk,
  type Il1IdentityStage,
  type DbIdentityStage,
} from "./IdentityEngine.js";

export {
  calculateIdentityDimensions,
  type IdentityDimensionScores,
} from "./identityDimensions.js";

export { buildIdentityPanelView, STAGE_CUSTOMER_LABELS } from "./IdentityPanelProjection.js";
