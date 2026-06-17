#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;

function env(name, fallback = undefined) {
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

const DATABASE_URL =
  env("DATABASE_URL") ?? "postgresql://postgres:postgres@127.0.0.1:5432/torgima_test";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const q1 = `
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name NOT LIKE 'erector_%'
AND table_name NOT LIKE '_drizzle%'
AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;
`.trim();

  const q2 = `
SELECT table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = t.table_name AND table_schema = 'public') as col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name LIKE 'erector_%'
ORDER BY table_name;
`.trim();

  const q3a = `
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('dashboard_mode','erector_tier')
ORDER BY column_name;
`.trim();

  const q3b = `
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'blueprints'
AND column_name IN (
  'erector_state','erector_validation_id','erector_simulation_id',
  'erector_archetype','erector_launch_contract_id','blueprint_source'
)
ORDER BY column_name;
`.trim();

  const q3c = `
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'academy_tasks'
AND column_name IN ('capability_gap_id','learning_type','execution_requirement','erector_evidence_id')
ORDER BY column_name;
`.trim();

  const q3d = `
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'outcome_validations'
AND column_name IN ('target_id','evidence_score','outcome_movement_score','archetype_false_progress_patterns','correction_path_id')
ORDER BY column_name;
`.trim();

  const q4 = `
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE indexname IN (
  'one_active_blueprint_per_user',
  'one_current_signal_per_blueprint',
  'one_current_condition_per_blueprint',
  'one_current_enforcement_per_blueprint',
  'one_current_state_memory_per_blueprint',
  'one_current_domain_per_blueprint'
)
ORDER BY indexname;
`.trim();

  const q5 = `
SELECT 'threshold_matrix' as tbl, COUNT(*) as rows,
  STRING_AGG(tier || ':proceed=' || proceed_min_score::text, ', ' ORDER BY tier) as details
FROM erector_threshold_matrix
UNION ALL
SELECT 'archetype_rule_packs', COUNT(*),
  STRING_AGG(archetype_id, ', ' ORDER BY archetype_id)
FROM erector_archetype_rule_packs
UNION ALL
SELECT 'verdict_rules', COUNT(*) FILTER (WHERE active=true),
  'active rules'
FROM erector_verdict_rules
UNION ALL
SELECT 'model_versions', COUNT(*),
  STRING_AGG(component || '=' || current_version, ', ')
FROM erector_model_versions
UNION ALL
SELECT 'false_progress_patterns', COUNT(*),
  STRING_AGG(archetype, ', ')
FROM erector_false_progress_patterns
UNION ALL
SELECT 'capability_graph', COUNT(*), 'nodes'
FROM erector_capability_graph
UNION ALL
SELECT 'framework_veto_rules', COUNT(*),
  STRING_AGG(framework_id, ', ')
FROM erector_framework_veto_rules;
`.trim();

  const q6 = `
SELECT feature_name, enabled FROM feature_flags ORDER BY feature_name;
`.trim();

  const out = {
    databaseUrlHost: (() => {
      try {
        const u = new URL(DATABASE_URL.replace(/^postgresql:/i, "postgres:"));
        return { host: u.hostname, port: u.port || "5432", database: u.pathname.replace(/^\//, "") };
      } catch {
        return { host: "unparseable", port: "?", database: "?" };
      }
    })(),
    doc02_tables: (await client.query(q1)).rows.map((r) => r.table_name),
    erector_tables: (await client.query(q2)).rows,
    critical_columns: {
      users: (await client.query(q3a)).rows,
      blueprints: (await client.query(q3b)).rows,
      academy_tasks: (await client.query(q3c)).rows.map((r) => r.column_name),
      outcome_validations: (await client.query(q3d)).rows.map((r) => r.column_name),
    },
    partial_unique_indexes: (await client.query(q4)).rows,
    seed_integrity: (await client.query(q5)).rows,
    feature_flags: (await client.query(q6)).rows,
    generatedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(out, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

