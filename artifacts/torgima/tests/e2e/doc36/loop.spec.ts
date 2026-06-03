import { test, expect } from "@playwright/test";

/**
 * DOC 36 — frontend loop gate (shell + copy + feedback guardrails).
 * Full DB loop runs in api-server `src/tests/e2e/doc36`.
 */
const FORBIDDEN_INTERNAL = /ControlEngine|SignalWorker|dead_letter_events|enforcement_package|signal_snapshot/i;

test.describe("DOC 36 — Frontend E2E gate", () => {
  test("dashboard route shows loading or content — never empty body", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const body = await page.locator("body").innerText();
    expect(body.trim().length).toBeGreaterThan(10);
  });

  test("onboarding route is reachable", async ({ page }) => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
  });

  test("signals route resolves (auth gate or dashboard)", async ({ page }) => {
    await page.goto("/signals", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(20);
    expect(body).not.toMatch(FORBIDDEN_INTERNAL);
  });

  test("feedback route resolves through auth gate", async ({ page }) => {
    await page.goto("/feedback/test-order-id", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(20);
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
