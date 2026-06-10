import { expect, type Page } from "@playwright/test";

/**
 * Unauthenticated users should be redirected to /login within a few seconds.
 * The login page renders a "Welcome back" heading (password auth flow).
 * Timeouts are intentionally short — if the redirect doesn't happen quickly
 * the test should fail fast rather than waiting 60 s.
 */
export async function expectLoginAuthGate(page: Page): Promise<void> {
  await page.waitForURL(/\/login(\?|$)/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({
    timeout: 10_000,
  });
}

export async function gotoProtectedRoute(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  // networkidle may never fire when Supabase client is active; don't block on it.
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}
