import { test, expect } from "@playwright/test";
import { expectLoginAuthGate, gotoProtectedRoute } from "../helpers/auth-gate";

/**
 * DOC 36 — frontend loop gate (shell + copy + feedback guardrails).
 * Full DB loop runs in api-server `src/tests/e2e/doc36`.
 */
const FORBIDDEN_INTERNAL = /ControlEngine|SignalWorker|dead_letter_events|enforcement_package|signal_snapshot/i;

test.describe("DOC 36 — Frontend E2E gate", () => {
  test("dashboard route shows login gate when no API session exists", async ({ page }) => {
    await gotoProtectedRoute(page, "/dashboard");
    await expectLoginAuthGate(page);
  });

  test("onboarding route redirects to login without session", async ({ page }) => {
    await gotoProtectedRoute(page, "/onboarding");
    await expectLoginAuthGate(page);
  });

  test("signals route resolves through login auth gate", async ({ page }) => {
    await gotoProtectedRoute(page, "/signals");
    await expectLoginAuthGate(page);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(FORBIDDEN_INTERNAL);
  });

  test("feedback route resolves through login auth gate", async ({ page }) => {
    await gotoProtectedRoute(page, "/feedback/test-order-id");
    await expectLoginAuthGate(page);
  });

  test("no forbidden internal engine terms on marketing shell", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(FORBIDDEN_INTERNAL);
  });

  test("language layer maps condition labels (no raw nothingness)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).not.toMatch(/\bnothingness\b/);
  });
});
