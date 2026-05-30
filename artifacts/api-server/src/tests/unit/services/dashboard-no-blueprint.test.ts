import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../services/BlueprintService.js", () => ({
  BlueprintService: {
    list: vi.fn(async () => []),
  },
}));

vi.mock("../../../services/AuthService.js", () => ({
  getUser: vi.fn(async () => ({
    id: "user-1",
    email: "test@example.com",
    tier: "starter",
  })),
}));

vi.mock("../../../services/OrderService.js", () => ({
  OrderService: {
    getActive: vi.fn(async () => []),
    getPrimaryDashboardTask: vi.fn(async () => null),
  },
}));

vi.mock("../../../services/SignalService.js", () => ({
  SignalService: {
    getCurrent: vi.fn(async () => ({
      userId: "user-1",
      momentum: 0,
      consistency: 0,
      velocity: 0,
      condition: "NOTHINGNESS",
      streak: 0,
      computedAt: new Date().toISOString(),
    })),
  },
}));

vi.mock("../../../services/FeedbackService.js", () => ({
  FeedbackService: {
    getRecent: vi.fn(async () => []),
  },
}));

import { DashboardService } from "../../../services/DashboardService.js";

describe("DashboardService.getDashboardState without active blueprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200-safe empty state fields", async () => {
    const state = await DashboardService.getDashboardState("user-1");
    expect(state.hasActiveBlueprint).toBe(false);
    expect(state.state).toBe("NO_ACTIVE_BLUEPRINT");
    expect(state.activeBlueprint).toBeNull();
    expect(state.dashboardUiState).toBe("NO_BLUEPRINT");
  });
});
