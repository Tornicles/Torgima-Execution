/**
 * BHUDHI_CURSOR_PROMPT_14 — public marketing website.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const torgimaRoot = resolve(process.cwd(), "../torgima");

function readTorgima(path: string) {
  return readFileSync(resolve(torgimaRoot, path), "utf8");
}

const pages = [
  "src/pages/landing.tsx",
  "src/pages/how-it-works.tsx",
  "src/pages/pricing.tsx",
  "src/pages/about.tsx",
  "src/pages/changelog.tsx",
];

describe("Prompt 14 — Marketing pages", () => {
  it("TEST 1: homepage is static and lightweight", () => {
    const page = readTorgima("src/pages/landing.tsx");
    expect(page).toContain("The execution system that never stops working for you.");
    expect(page).not.toContain("fetch(");
    expect(page.length).toBeLessThan(16_000);
  });

  it("TEST 2: navigation and internal routes are wired", () => {
    const app = readTorgima("src/App.tsx");
    for (const route of ["/", "/how-it-works", "/pricing", "/about", "/changelog"]) {
      expect(app).toContain(`path="${route}"`);
    }
    const layout = readTorgima("src/components/marketing/MarketingLayout.tsx");
    for (const href of ["/how-it-works", "/pricing", "/about", "/changelog", "/signup"]) {
      expect(layout).toContain(`href: "${href}"`);
    }
  });

  it("TEST 3: CTA flow points to signup", () => {
    for (const file of ["src/pages/landing.tsx", "src/pages/how-it-works.tsx", "src/pages/about.tsx"]) {
      expect(readTorgima(file)).toContain('href="/signup"');
    }
  });

  it("TEST 4: pricing tiers match shipped capabilities", () => {
    const pricing = readTorgima("src/pages/pricing.tsx");
    for (const claim of [
      "Full execution loop",
      "All 7 conditions",
      "Academy and capability gap detection",
      "Full overnight intelligence",
      "Daily Morning Intelligence Report",
      "Strategic Outlook Panel",
      "Competitor tracking",
      "Trend velocity scoring",
      "Narrative intelligence",
    ]) {
      expect(pricing).toContain(claim);
    }
  });

  it("TEST 5: all pages include responsive classes for mobile layout", () => {
    for (const file of pages) {
      const source = readTorgima(file);
      expect(source).toMatch(/sm:|md:|lg:/);
      expect(source).not.toContain("min-w-[");
    }
  });

  it("TEST 6: SEO metadata and OG image are configured", () => {
    const index = readTorgima("index.html");
    const metadata = readTorgima("src/lib/marketing-metadata.ts");
    expect(index).toContain("Torgima — The Execution Operating System");
    expect(index).toContain('property="og:image" content="https://torgima.com/og-image.png"');
    expect(metadata).toContain("useMarketingMetadata");
    expect(statSync(resolve(torgimaRoot, "public/og-image.png")).size).toBeGreaterThan(1_000);
    expect(readTorgima("public/sitemap.xml")).toContain("https://torgima.com/pricing");
  });

  it("TEST 7: how-it-works accurately describes the implemented loop", () => {
    const page = readTorgima("src/pages/how-it-works.tsx");
    for (const phrase of ["Goal", "Blueprint", "Tasks", "Feedback", "Signals", "Conditions", "New Tasks", "The three laws"]) {
      expect(page).toContain(phrase);
    }
  });

  it("TEST 8: marketing pages do not render dashboard-only UI terms", () => {
    for (const file of pages) {
      const page = readTorgima(file);
      expect(page).not.toMatch(/\bOrder\b|\bOrders\b|ConditionBadge|SignalBar|DashboardStateRouter/);
    }
  });

  it("TEST 9: changelog lists only Phase 1 shipped work", () => {
    const page = readTorgima("src/pages/changelog.tsx");
    for (const shipped of [
      "Goal validation",
      "Execution blueprint generation",
      "Continuous task loop",
      "Academy and capability development",
      "Morning Intelligence Report",
      "Dashboard intelligence panels",
    ]) {
      expect(page).toContain(shipped);
    }
    expect(page).not.toContain("Psychological Civilization complete");
  });

  it("TEST 10: manifesto keeps honest positioning", () => {
    const page = readTorgima("src/pages/about.tsx");
    expect(page).toContain("It cannot fake your progress");
    expect(page).toContain("Reality governs the system");
    expect(page).not.toMatch(/guarantee|autonomous decision|replaces your judgment/i);
  });
});
