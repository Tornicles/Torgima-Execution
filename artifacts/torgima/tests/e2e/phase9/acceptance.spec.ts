import { test, expect } from "@playwright/test";

/**
 * Prompt 9 — browser acceptance (shell + routes).
 * Full loop scenarios run in api-server `src/tests/e2e/phase9` against real Postgres.
 */
test.describe("Phase 9 — Frontend acceptance", () => {
  test("dashboard route renders without raw engine errors", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("TORGIMA_OS")).toBeVisible({ timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/ControlEngine|SignalWorker|dead_letter_events/i);
  });

  test("onboarding route is reachable", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByText(/TORGIMA/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("signals route resolves in SPA", async ({ page }) => {
    await page.goto("/signals");
    await expect(page.getByText("TORGIMA_OS")).toBeVisible({ timeout: 20_000 });
  });
});
