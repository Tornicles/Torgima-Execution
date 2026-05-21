import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env") });
dotenv.config({ path: join(repoRoot, "artifacts/api-server/.env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const { db, pool } = await import("./index.js");
const { featureFlags, users, capabilityProfiles, knowledgeObjects } = await import("./schema/index.js");

async function seedFeatureFlags() {
  const flags = [
    // Phase 1 — ON
    { feature_name: "ai_enabled",                    enabled: true,  description: "Core Bhudhi AI — task generation, feedback interpretation, validation" },
    { feature_name: "academy_enabled",               enabled: true,  description: "Academy task system with Phase 1 content set" },
    { feature_name: "identity_system_enabled",       enabled: true,  description: "Identity continuity and transformation engine" },
    { feature_name: "compulsion_loop_enabled",       enabled: true,  description: "Streak tracking, milestones, reward events" },
    { feature_name: "outcome_validation_enabled",    enabled: true,  description: "Real outcome tracking and false progress detection" },
    { feature_name: "principles_365_enabled",        enabled: true,  description: "365 Principles daily execution laws + accountability" },
    { feature_name: "calendar_enabled",              enabled: true,  description: "Native Torgima calendar with conflict detection" },
    { feature_name: "chat_enabled",                  enabled: true,  description: "Personal chat, voice memos, blocker logging" },
    { feature_name: "notifications_multi_channel_enabled", enabled: true, description: "Slack, email, SMS, in-app notification delivery" },
    { feature_name: "gamification_enabled",              enabled: true,  description: "XP, levels, streaks, achievements, avatar" },
    { feature_name: "mobile_app_enabled",                enabled: true,  description: "Mobile app API, widgets, offline sync, health" },
    { feature_name: "analytics_enabled",                 enabled: true,  description: "Execution, principles, academy, content analytics dashboards" },
    { feature_name: "public_profiles_enabled",           enabled: true,  description: "Public accountability profiles, shareable entries, widgets" },
    // Phase 2 — OFF
    { feature_name: "team_mode_enabled",             enabled: false, description: "Team mode — Phase 2 only" },
    { feature_name: "community_enabled",             enabled: false, description: "Community feed and social layer — Phase 2 only" },
    { feature_name: "advanced_domains_enabled",      enabled: false, description: "Operations full + Growth + People domains — Phase 2 only" },
    { feature_name: "advanced_frameworks_enabled",   enabled: false, description: "All 14 frameworks at full activation — Phase 2 only" },
    { feature_name: "ai_advanced_enabled",           enabled: false, description: "Multi-agent AI, autonomous workflows — Phase 2" },
    { feature_name: "marketplace_enabled",           enabled: false, description: "Blueprint marketplace — Phase 2" },
    { feature_name: "content_engine_enabled",        enabled: false, description: "Daily content generation — Phase 2" },
    { feature_name: "predictive_signals_enabled",    enabled: false, description: "Predictive burnout and failure detection — Ultimate tier only" },
    { feature_name: "external_integrations_enabled", enabled: true, description: "Calendar, health, Slack/Discord, social publish, webhooks, Zapier" },
  ];

  for (const flag of flags) {
    await db
      .insert(featureFlags)
      .values({ ...flag, environment: "all" })
      .onConflictDoUpdate({
        target: featureFlags.feature_name,
        set: { description: flag.description },
      });
  }

  console.log(`Seeded ${flags.length} feature flags`);
}

async function seedDevUsers() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping dev users in production");
    return;
  }

  const devUsers = [
    { email: "dev@torgima.com",           display_name: "Dev User",      tier: "growth"   as const, mode: "individual" as const },
    { email: "test-starter@torgima.com",  display_name: "Test Starter",  tier: "starter"  as const, mode: "individual" as const },
    { email: "test-ultimate@torgima.com", display_name: "Test Ultimate", tier: "ultimate" as const, mode: "individual" as const },
  ];

  let seeded = 0;
  for (const u of devUsers) {
    const [created] = await db
      .insert(users)
      .values({ ...u, onboarding_complete: false })
      .onConflictDoNothing()
      .returning();

    if (created) {
      await db
        .insert(capabilityProfiles)
        .values({ user_id: created.id })
        .onConflictDoNothing();
      seeded++;
    }
  }

  console.log(`Seeded ${seeded} dev users`);
}

async function seedGlobalKnowledge() {
  const objects = [
    {
      id: "global-genesis-goal-clarity-sop",
      title: "Goal Clarity SOP",
      content: "A clear goal must answer: What exactly will be different? By when? How will you know? Vague goals produce vague execution. Rewrite goals until they are measurable, time-bound, and binary — either achieved or not.",
      type: "sop", domain: "genesis" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-genesis-execution-benchmark",
      title: "Execution Quality Benchmark",
      content: "Production-grade execution means: tasks completed within the stated time estimate 80% of the time, feedback submitted within 2 hours of completion, proof attached when required, reflection contains at least one specific observation about what changed.",
      type: "benchmark", domain: "genesis" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-delivery-output-benchmark",
      title: "Output Quality Benchmark",
      content: "Measure against deliverable criteria, not effort. A task is complete when the expected output exists and matches the definition of done. Measure against this, not against your effort.",
      type: "benchmark", domain: "delivery" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-delivery-blocker-response-sop",
      title: "Blocker Response SOP",
      content: "When blocked: (1) Name the blocker specifically — vague blockers cannot be resolved. (2) Is it a skill gap, resource gap, dependency, or decision gap? (3) For each: skill = academy task, resource = scope reduction, dependency = flag and move to next task, decision = escalate immediately.",
      type: "sop", domain: "delivery" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-genesis-procrastination-pattern",
      title: "Procrastination Pattern",
      content: "Procrastination in execution systems appears as: tasks started but not completed, tasks opened multiple times without submission, consistent delay between task generation and task start. The fix is not motivation — it is task simplification and smaller proof requirements.",
      type: "failure_pattern", domain: "genesis" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-genesis-burnout-warning-pattern",
      title: "Burnout Warning Pattern",
      content: "Burnout precursors: completion rate drops more than 30% over 5 days, score inflation appears (high scores with low reflection quality), tasks marked complete with minimal proof. Do not increase load when these signals appear. Reduce and recover.",
      type: "failure_pattern", domain: "genesis" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-genesis-recovery-sprint-toolbox",
      title: "Recovery Sprint Toolbox",
      content: "After a missed period: (1) Do not try to catch up on missed tasks. (2) Start from current position only. (3) First task back is always easy difficulty. (4) Score does not matter on day one of recovery — completion does. (5) Three consecutive completions before returning to normal difficulty.",
      type: "toolbox", domain: "genesis" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-market-demand-validation-sop",
      title: "Demand Validation SOP",
      content: "Demand is validated when: (1) A real person outside your network has expressed willingness to pay or use. (2) You have received feedback that confirms the problem exists for them, not just for you. (3) You can describe the exchange — what they give, what they receive — in one sentence.",
      type: "sop", domain: "market" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-delivery-false-progress-pattern",
      title: "False Progress Pattern",
      content: "False progress: high task completion rate with no real-world output movement. Signs: all tasks completed, targets not advancing, no external validation, reflection is activity-based not outcome-based. Fix: switch from output tasks to validation tasks immediately.",
      type: "failure_pattern", domain: "delivery" as const, applicable_level: "all", is_global: true,
    },
    {
      id: "global-genesis-phase-gate-sop",
      title: "Phase Gate SOP",
      content: "A phase is complete when all gate criteria are met — not when time expires. Gate criteria are binary: either the deliverable exists and meets the definition of done, or it does not. Review each criterion independently. Do not aggregate into a subjective score.",
      type: "sop", domain: "genesis" as const, applicable_level: "all", is_global: true,
    },
  ];

  for (const obj of objects) {
    await db
      .insert(knowledgeObjects)
      .values(obj)
      .onConflictDoUpdate({
        target: knowledgeObjects.id,
        set: { content: obj.content },
      });
  }

  console.log(`Seeded ${objects.length} global knowledge objects`);
}

async function main() {
  console.log("Starting seed...");
  await seedFeatureFlags();
  await seedDevUsers();
  await seedGlobalKnowledge();
  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
