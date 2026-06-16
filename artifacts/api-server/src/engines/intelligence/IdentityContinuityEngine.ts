/**
 * IL1 / DOC_18 — Identity Continuity Engine (canonical implementation in engines/identity/).
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
  calculateStage,
  calculateRegressionRisk,
  customerLabelForStage,
  DB_TO_IL1_STAGE,
  IL1_TO_DB_STAGE,
  type Il1IdentityStage,
  type DbIdentityStage,
  type IdentityEvaluationResult,
} from "../identity/IdentityEngine.js";

export { buildIdentityPanelView, STAGE_CUSTOMER_LABELS } from "../identity/IdentityPanelProjection.js";
export { collectTransformationEvidence, type TransformationEvidence } from "../identity/TransformationEvidenceCollector.js";
