/** DOC 36 — dedicated loop test account (override via env). */
export const DOC36_TEST_EMAIL =
  process.env.DOC36_TEST_EMAIL?.trim() || "testuser@torgima-test.com";

export const DOC36_LOOP_BUDGET_MS = Number(process.env.DOC36_LOOP_BUDGET_MS ?? 15_000);

export const DOC36_API_BASE = process.env.DOC36_API_BASE?.replace(/\/$/, "") ?? "";
