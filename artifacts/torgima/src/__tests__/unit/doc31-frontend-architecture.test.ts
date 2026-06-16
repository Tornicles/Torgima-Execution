import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STALE_BANNER_MESSAGE,
  isStaleStateError,
} from "@/lib/state-version";
import {
  CONDITION_LABELS,
  ERECTOR_STATE_LABELS,
  getConditionLabel,
  getErectorStateLabel,
} from "@/lib/language-map";

const root = resolve(import.meta.dirname, "../../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DOC 31 — Frontend architecture", () => {
  it("provides api client with credentials and 401 handling", () => {
    const client = readRepo("src/api/client.ts");
    expect(client).toContain('credentials: "include"');
    expect(client).toContain("redirectToLogin");
    expect(client).toContain("res.status === 401");
  });

  it("exposes lib/api-client.ts canonical entry", () => {
    const entry = readRepo("src/lib/api-client.ts");
    expect(entry).toContain("apiRequest");
    expect(entry).toContain("@/api/client");
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
    const guard = readRepo("src/hooks/useSessionGuard.ts");
    expect(guard).toContain("onAuthStateChange");
    expect(guard).toContain("supabase");
    const hook = readRepo("src/hooks/useDashboardProjection.ts");
    expect(hook).toContain("invalidate");
    expect(hook).toContain("PENDING_SYNC_POLL_MS");
  });

  it("mutation helper invalidates dashboard after success and handles STALE_STATE", () => {
    const mutations = readRepo("src/lib/mutations.ts");
    expect(mutations).toContain("handleStaleStateConflict");
    expect(mutations).toContain("STALE_STATE");
    expect(mutations).toContain("invalidateAfterFeedback");
  });

  it("state-version module tracks stale refresh flow", () => {
    const stateVersion = readRepo("src/lib/state-version.ts");
    expect(stateVersion).toContain("useStateVersion");
    expect(stateVersion).toContain("handleStaleStateConflict");
    expect(stateVersion).toContain(STALE_BANNER_MESSAGE);
  });

  it("shared UI states for loading, error, stale, and lock", () => {
    expect(readRepo("src/components/shared/StaleBanner.tsx")).toContain("StaleBanner");
    expect(readRepo("src/components/shared/LoadingState.tsx")).toContain("LoadingState");
    expect(readRepo("src/components/shared/ErrorState.tsx")).toContain("ErrorState");
    expect(readRepo("src/components/shared/LockState.tsx")).toContain("LockState");
  });

  it("React Query uses DOC31 stale and cache times", () => {
    const app = readRepo("src/App.tsx");
    expect(app).toContain("staleTime: 30_000");
    expect(app).toContain("gcTime: 5 * 60_000");
    expect(app).toContain("retry: 2");
  });

  it("query-keys define signals and outcomes invalidation", () => {
    const keys = readRepo("src/lib/query-keys.ts");
    expect(keys).toContain("signals");
    expect(keys).toContain("outcomes");
    expect(keys).toContain("invalidateAfterFeedback");
    expect(keys).toContain("invalidateAfterOrderStart");
  });

  it("language-map translates internal condition and erector states", () => {
    expect(CONDITION_LABELS.nothingness).toBe("Not Started");
    expect(ERECTOR_STATE_LABELS.VALIDATION_RUNNING).toContain("Analys");
    expect(getConditionLabel("danger")).toBe("At Risk");
    expect(getErectorStateLabel("LAUNCH_PERMITTED")).toBe("Ready to launch");
    expect(readRepo("src/lib/language-map.ts")).toContain("ERECTOR_STATE_LABELS");
  });

  it("feedback form prevents double submission and never fakes success on stale", () => {
    const form = readRepo("src/components/tasks/FeedbackForm.tsx");
    expect(form).toContain("if (submitting) return");
    expect(form).toContain("disabled={submitting}");
    expect(form).not.toMatch(/STALE_STATE[\s\S]*onSuccess\(\)/);
  });

  it("ErrorBoundary wraps protected routes", () => {
    expect(readRepo("src/components/ErrorBoundary.tsx")).toContain("ErrorBoundary");
    expect(readRepo("src/App.tsx")).toContain("useSessionGuard");
    expect(readRepo("src/App.tsx")).toContain("<ErrorBoundary>");
    expect(readRepo("src/App.tsx")).toContain("StaleBanner");
  });
});

describe("frontend-state-sync", () => {
  it("detects stale state error codes", () => {
    expect(isStaleStateError("STALE_STATE")).toBe(true);
    expect(isStaleStateError("VALIDATION_ERROR")).toBe(false);
  });
});
