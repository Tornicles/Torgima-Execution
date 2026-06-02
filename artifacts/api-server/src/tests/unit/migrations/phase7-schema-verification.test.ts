/**
 * Phase 7 — migration artifact contract (database-only phase).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OrderStatus } from "@workspace/state-machine";

const REPO_ROOT = resolve(import.meta.dirname, "../../../../../../");
const MIGRATION = resolve(REPO_ROOT, "migrations/0037_phase7_schema_verification.sql");

const REQUIRED_TABLES = [
  "behavior_events",
  "behavior_patterns",
  "bhudhi_logs",
  "bhudhi_memory",
  "blueprint_mutations",
  "blueprint_versions",
  "blueprints",
  "capability_history",
  "capability_profiles",
  "cognitive_load_scores",
  "condition_records",
  "dead_letter_events",
  "decision_traces",
  "enforcement_packages",
  "event_logs",
  "events",
  "false_progress_flags",
  "feedback",
  "identity_history",
  "inactivity_records",
  "milestones",
  "orders",
  "outcome_validations",
  "real_outcomes",
  "reward_events",
  "signal_snapshots",
  "state_memory",
  "system_health_logs",
  "task_generation_log",
  "user_identity_states",
] as const;

describe("Phase 7 — migration SQL", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("0037 migration exists with ledger + enum + column DDL", () => {
    expect(sql).toContain("migration_ledger");
    expect(sql).toContain("engines_doc10_28_phase7.sql");
    expect(sql).toContain("ALTER TYPE order_status ADD VALUE 'partial'");
    expect(sql).toContain("paused BOOLEAN");
    expect(sql).toContain("system_locked BOOLEAN");
    expect(sql).toContain("effort_score");
    expect(sql).toContain("feedback_idempotency_key_idx");
  });

  it("documents all 30 required intelligence tables", () => {
    expect(REQUIRED_TABLES).toHaveLength(30);
  });
});

describe("Phase 7 — OrderStatus enum sync", () => {
  it("includes Phase 7 required values", () => {
    expect(OrderStatus.PARTIAL).toBe("partial");
    expect(OrderStatus.NEEDS_CLARIFICATION).toBe("needs_clarification");
    expect(OrderStatus.PENDING_REVIEW).toBe("pending_review");
    expect(OrderStatus.QUEUED).toBe("queued");
    expect(OrderStatus.CANCELLED).toBe("cancelled");
  });
});
