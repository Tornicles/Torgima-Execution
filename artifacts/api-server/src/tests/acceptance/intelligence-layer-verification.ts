/**
 * IL5 — full intelligence layer verification queries (Phase B).
 * Run with TORGIMA_INTEGRATION=true against a seeded test user.
 */

export const INTELLIGENCE_TABLE_CHECKS = [
  { key: "identity_states", table: "user_identity_states", userColumn: "user_id" },
  { key: "identity_history", table: "identity_history", userColumn: "user_id" },
  { key: "reward_events", table: "reward_events", userColumn: "user_id" },
  { key: "outcome_validations", table: "outcome_validations", userColumn: "user_id" },
  { key: "behavior_patterns", table: "behavior_patterns", userColumn: "user_id" },
  { key: "decision_traces", table: "decision_traces", userColumn: "user_id" },
  { key: "behavior_events", table: "behavior_events", userColumn: "user_id" },
] as const;

export const CORE_LOOP_CHECKS = [
  "signal_snapshots.is_current",
  "conditions.is_current",
  "enforcement_packages.is_current",
  "execution.active_order",
  "dashboard.identity.stage",
  "bhudhi_logs.9_triggers",
] as const;

export const BHUDHI_TRIGGER_TYPES = [
  "INTERPRET",
  "STRATEGY",
  "TASK_COPY",
  "RECOVERY",
  "ACADEMY_SUPPORT",
  "ROOT_CAUSE_ASSIST",
  "CONDITION_ADVISORY",
  "KNOWLEDGE_INJECT",
  "CRITIC_REVIEW",
] as const;

export function formatIntelligenceVerificationSql(userId: string): string {
  const unions = INTELLIGENCE_TABLE_CHECKS.map(
    (c) =>
      `SELECT '${c.key}' AS tbl, COUNT(*)::int AS cnt FROM ${c.table} WHERE ${c.userColumn} = '${userId}'`,
  ).join("\nUNION ALL\n");
  return `${unions}\nORDER BY tbl;`;
}

export function allTablesPopulated(counts: Record<string, number>): boolean {
  return INTELLIGENCE_TABLE_CHECKS.every((c) => (counts[c.key] ?? 0) > 0);
}
