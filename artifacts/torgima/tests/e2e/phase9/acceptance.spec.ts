import { test, expect } from "@playwright/test";

/**
 * Prompt 9 — browser acceptance (shell + routes).
 * Full loop scenarios run in api-server `src/tests/e2e/phase9` against real Postgres.
 */
test.describe("Phase 9 — Frontend acceptance", () => {
  test("marketing route renders without raw engine errors", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /execution system/i })).toBeVisible({ timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/ControlEngine|SignalWorker|dead_letter_events/i);
  });

  test("onboarding route is reachable", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
  });

  test("signals route resolves through the auth gate", async ({ page }) => {
    await page.goto("/signals");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
  });

  test("QUAL-05: no forbidden execution-language in visible shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /execution system/i })).toBeVisible({ timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).not.toMatch(/\bcongratulations\b/);
    expect(body.toLowerCase()).not.toMatch(/\bgreat job\b/);
    expect(body.toLowerCase()).not.toMatch(/\bto-do\b/);
  });
});
