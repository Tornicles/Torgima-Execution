/**
 * Prompt 9 §7 — canonical test fixture catalog (referenced by E2E suites).
 * Runtime seeds use `seedPhase9Fixture()`; these constants document intent and inputs.
 */

export const TEST_USERS = {
  newUser: {
    email: "new@test.torgima.com",
    name: "Test New User",
    onboardingComplete: false,
  },
  activeUser: {
    email: "active@test.torgima.com",
    name: "Test Active User",
    onboardingComplete: true,
    currentCondition: "stability",
  },
  dangerUser: {
    email: "danger@test.torgima.com",
    name: "Test Danger User",
    onboardingComplete: true,
    currentCondition: "danger",
  },
  powerUser: {
    email: "power@test.torgima.com",
    name: "Test Power User",
    onboardingComplete: true,
    currentCondition: "power",
  },
  burnoutUser: {
    email: "burnout@test.torgima.com",
    name: "Test Burnout User",
    onboardingComplete: true,
  },
} as const;

export const TEST_GOALS = {
  validContentGoal: {
    goalText: "I want to grow my soccer content to 10,000 followers",
    purposeText: "To build an audience that funds my passion for football",
    timeframe: "6 months",
    contextData: {
      currentCapability: "Intermediate",
      availableHours: 10,
      niche: "soccer content creation",
    },
  },
  contradictionGoal: {
    goalText: "I want total privacy AND global viral influence with no team",
    purposeText: "Freedom and fame simultaneously",
    timeframe: "3 months",
  },
  unrealisticGoal: {
    goalText: "I want 10 million followers in 1 week",
    purposeText: "To be famous immediately",
    timeframe: "7 days",
  },
} as const;

export const TEST_SIGNALS = {
  stabilitySignals: {
    completionRate: 0.65,
    scoreAverage: 7.5,
    momentum: 60,
    consistency: 0.7,
    confidence: 0.65,
    trendDirection: "stable",
  },
  dangerSignals: {
    completionRate: 0.2,
    scoreAverage: 5.0,
    momentum: 10,
    consistency: 0.25,
    confidence: 0.2,
    trendDirection: "declining",
  },
  powerSignals: {
    completionRate: 0.85,
    scoreAverage: 8.5,
    momentum: 80,
    consistency: 0.9,
    confidence: 0.85,
    trendDirection: "rising",
  },
} as const;

/** Maps Prompt 9 fixture names to `seedPhase9Fixture` keys. */
export {
  seedErectorFixture,
  cleanupErectorFixture,
  seedStuckValidationFixture,
  countArchetypesWithSubstance,
  type ErectorFixture,
  type ErectorFixtureName,
} from "./erector-fixtures.js";

export { ERECTOR_FIXTURE_NAMES } from "./erector-fixtures.js";

export const FIXTURE_ALIASES = {
  newUser: "new_user_minimal",
  activeUser: "stable_user_active",
  dangerUser: "danger_user_restricted",
  falseProgressUser: "false_progress_user",
  inactivityUser: "inactivity_user",
  pivotUser: "pivot_required_user",
} as const;
