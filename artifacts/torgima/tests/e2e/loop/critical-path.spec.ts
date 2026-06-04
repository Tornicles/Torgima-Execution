import { test, expect } from "@playwright/test";
import { expectLoginAuthGate, gotoProtectedRoute } from "../helpers/auth-gate";

/**
 * SPA smoke checks for the Phase 1 Vite shell (canonical frontend).
 * Install browsers once: `pnpm -F @workspace/torgima exec playwright install chromium`.
 */
test.describe("Torgima critical path — SPA shell", () => {
  test("marketing home renders with brand chrome", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /execution system/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /start your blueprint/i }).first()).toBeVisible();
  });

  test("dashboard is protected when no API session exists", async ({ page }) => {
    await gotoProtectedRoute(page, "/dashboard");
    await expectLoginAuthGate(page);
  });

  test("signals route resolves through the auth gate", async ({ page }) => {
    await gotoProtectedRoute(page, "/signals");
    await expectLoginAuthGate(page);
  });
});
