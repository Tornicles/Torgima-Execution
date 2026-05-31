import { test, expect } from "@playwright/test";

/**
 * Mobile layout smoke at 375px — validation results, feedback, dashboard shells.
 */
test.use({ viewport: { width: 375, height: 812 } });

const MOBILE_ROUTES = ["/validation-results", "/feedback", "/dashboard", "/erector"];

test.describe("Mobile layout (375px)", () => {
  for (const path of MOBILE_ROUTES) {
    test(`${path} renders without horizontal overflow`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => null);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 2;
      });
      expect(overflow).toBe(false);

      const body = await page.locator("body").innerText();
      expect(body.length).toBeGreaterThan(0);
      expect(body).not.toMatch(/ControlEngine|dead_letter_events/i);
    });
  }
});
