import { test, expect } from "@playwright/test";

/**
 * SPA smoke checks for the Phase 1 Vite shell (canonical frontend).
 * Start the UI: `pnpm -F @workspace/torgima dev` (defaults to port 5173).
 * Install browsers once: `pnpm -F @workspace/torgima exec playwright install chromium`.
 */
test.describe("Torgima critical path — SPA shell", () => {
  test("layout renders with brand chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("TORGIMA_OS")).toBeVisible({ timeout: 20_000 });
  });

  test("dashboard shows loading, data shell, or API error fallback", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("heading", { name: /SYSTEM_OVERVIEW/i });
    const failed = page.getByText(/Failed to load dashboard/i);
    await expect(banner.or(failed).first()).toBeVisible({ timeout: 25_000 });
  });

  test("signals route resolves inside SPA router", async ({ page }) => {
    await page.goto("/signals");
    await expect(page.getByText("TORGIMA_OS")).toBeVisible({ timeout: 20_000 });
  });
});
