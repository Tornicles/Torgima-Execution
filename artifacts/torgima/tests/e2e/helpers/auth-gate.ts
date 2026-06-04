import { expect, type Page } from "@playwright/test";

/** Unauthenticated users should land on magic-link login (DOC 31 session guard). */
export async function expectLoginAuthGate(page: Page): Promise<void> {
  await page.waitForURL(/\/login(\?|$)/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({
    timeout: 25_000,
  });
}

export async function gotoProtectedRoute(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
}
