import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DOC 31 — Frontend architecture", () => {
  it("provides api client with credentials and 401 handling", () => {
    const client = readRepo("src/api/client.ts");
    expect(client).toContain('credentials: "include"');
    expect(client).toContain("redirectToLogin");
    expect(client).toContain("res.status === 401");
  });

  it("creates typed API wrappers for five endpoint groups", () => {
    expect(readRepo("src/api/auth.ts")).toContain("fetchAuthSession");
    expect(readRepo("src/api/onboarding.ts")).toContain("fetchOnboardingStatus");
    expect(readRepo("src/api/dashboard.ts")).toContain("fetchDashboardProjection");
    expect(readRepo("src/api/orders.ts")).toContain("submitOrderFeedback");
    expect(readRepo("src/api/intelligence.ts")).toContain("fetchIdentityCurrent");
  });

  it("creates session, dashboard, and onboarding stores", () => {
    expect(readRepo("src/store/sessionStore.ts")).toContain("useSessionStore");
    expect(readRepo("src/store/dashboardStore.ts")).toContain("invalidate");
    expect(readRepo("src/store/onboardingStore.ts")).toContain("useOnboardingStore");
  });

  it("implements useSessionGuard and useDashboardProjection invalidate", () => {
    expect(readRepo("src/hooks/useSessionGuard.ts")).toContain("fetchAuthSession");
    const hook = readRepo("src/hooks/useDashboardProjection.ts");
    expect(hook).toContain("invalidate");
    expect(hook).toContain("PENDING_SYNC_POLL_MS = 15_000");
  });

  it("mutation helper invalidates dashboard after success", () => {
    const mutations = readRepo("src/lib/mutations.ts");
    expect(mutations).toContain("invalidateDashboardProjection");
    expect(mutations).toContain("STALE_STATE");
  });

  it("language layer maps internal terms", () => {
    expect(readRepo("src/lib/language.ts")).toContain("INTERNAL_TERM_LABELS");
  });

  it("ErrorBoundary wraps protected routes", () => {
    expect(readRepo("src/components/ErrorBoundary.tsx")).toContain("ErrorBoundary");
    expect(readRepo("src/App.tsx")).toContain("useSessionGuard");
    expect(readRepo("src/App.tsx")).toContain("<ErrorBoundary>");
  });
});
