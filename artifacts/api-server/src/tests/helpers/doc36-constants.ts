/** DOC 36 — dedicated loop test account (override via env). */
export const DOC36_TEST_EMAIL =
  process.env.DOC36_TEST_EMAIL?.trim() || "testuser@torgima-test.com";

/** Full feedback loop budget (DOC 36 spec: under 10 seconds). */
export const DOC36_LOOP_BUDGET_MS = Number(process.env.DOC36_LOOP_BUDGET_MS ?? 10_000);

export const DOC36_API_BASE = process.env.DOC36_API_BASE?.replace(/\/$/, "") ?? "";

/** DOC 36 §4 — operation timing targets (ms). */
export const DOC36_TIMING = {
  initialTaskTargetMs: 3_000,
  initialTaskMaxMs: 5_000,
  fullLoopTargetMs: 5_000,
  fullLoopMaxMs: DOC36_LOOP_BUDGET_MS,
  signalRecalcTargetMs: 2_000,
  signalRecalcMaxMs: 4_000,
  bhudhiDraftTargetMs: 3_000,
  bhudhiDraftMaxMs: 8_000,
  erectorValidationTargetMs: 8_000,
  erectorValidationMaxMs: 15_000,
  dashboardFetchTargetMs: 1_000,
  dashboardFetchMaxMs: 3_000,
  proofUploadTargetMs: 10_000,
  proofUploadMaxMs: 30_000,
} as const;
