import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const queries = {
  "2.1 original_tables": `SELECT COUNT(*)::int AS count FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name NOT LIKE 'erector_%'
AND table_name NOT LIKE '_prisma%'
AND table_name NOT LIKE 'pg_%'`,
  "2.2 partial_indexes": `SELECT indexname FROM pg_indexes
WHERE indexname IN (
  'one_active_blueprint_per_user',
  'one_current_signal_per_blueprint',
  'one_current_condition_per_blueprint',
  'one_current_enforcement_per_blueprint',
  'one_current_state_memory_per_blueprint',
  'one_current_domain_per_blueprint'
) ORDER BY indexname`,
  "2.3 erector_tables": `SELECT COUNT(*)::int AS count FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'erector_%'`,
  "2.4 users_cols": `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('dashboard_mode', 'erector_tier') ORDER BY column_name`,
  "2.4 blueprints_cols": `SELECT column_name FROM information_schema.columns WHERE table_name = 'blueprints' AND column_name IN ('erector_state', 'erector_validation_id', 'erector_simulation_id', 'erector_archetype', 'erector_launch_contract_id', 'blueprint_source') ORDER BY column_name`,
  "2.4 academy_tasks_cols": `SELECT column_name FROM information_schema.columns WHERE table_name = 'academy_tasks' AND column_name IN ('capability_gap_id', 'learning_type', 'execution_requirement', 'erector_evidence_id') ORDER BY column_name`,
  "2.4 academy_proof_cols": `SELECT column_name FROM information_schema.columns WHERE table_name = 'academy_proof' AND column_name IN ('evidence_ledger_id', 'evidence_class', 'signal_validated', 'capability_confirmed') ORDER BY column_name`,
  "2.4 outcome_validations_cols": `SELECT column_name FROM information_schema.columns WHERE table_name = 'outcome_validations' AND column_name IN ('target_id', 'evidence_score', 'outcome_movement_score', 'archetype_false_progress_patterns', 'correction_path_id') ORDER BY column_name`,
  "2.4 false_progress_flags_cols": `SELECT column_name FROM information_schema.columns WHERE table_name = 'false_progress_flags' AND column_name IN ('archetype_pattern', 'evidence_ids', 'correction_path_id', 'false_progress_score') ORDER BY column_name`,
  "2.5 seed_data": `SELECT COUNT(*) as count, 'threshold_matrix' as tbl FROM erector_threshold_matrix
UNION ALL SELECT COUNT(*), 'archetype_rule_packs' FROM erector_archetype_rule_packs
UNION ALL SELECT COUNT(*) FILTER (WHERE active = true), 'verdict_rules' FROM erector_verdict_rules
UNION ALL SELECT COUNT(*), 'framework_veto_rules' FROM erector_framework_veto_rules
UNION ALL SELECT COUNT(*), 'model_versions' FROM erector_model_versions
UNION ALL SELECT COUNT(*), 'false_progress_patterns' FROM erector_false_progress_patterns
UNION ALL SELECT COUNT(*), 'capability_graph' FROM erector_capability_graph`,
  "2.6 phase2_flags": `SELECT feature_name, enabled FROM feature_flags
WHERE feature_name IN ('team_mode_enabled','community_enabled','marketplace_enabled','advanced_frameworks_enabled','ai_advanced_enabled','external_integrations_enabled')
ORDER BY feature_name`,
};

await client.connect();
for (const [name, sql] of Object.entries(queries)) {
  const res = await client.query(sql);
  console.log("=== " + name + " ===");
  console.log(JSON.stringify(res.rows, null, 2));
}
await client.end();
