import { test, expect } from "@playwright/test";

/**
 * SPA smoke checks for the Phase 1 Vite shell (canonical frontend).
 * Start the UI: `pnpm -F @workspace/torgima dev` (defaults to port 5173).
 * Install browsers once: `pnpm -F @workspace/torgima exec playwright install chromium`.
 */
test.describe("Torgima critical path — SPA shell", () => {
  test("marketing home renders with brand chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /execution system/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /start your blueprint/i }).first()).toBeVisible();
  });

  test("dashboard is protected when no API session exists", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 25_000 });
  });

  test("signals route resolves through the auth gate", async ({ page }) => {
    await page.goto("/signals");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
  });
});
