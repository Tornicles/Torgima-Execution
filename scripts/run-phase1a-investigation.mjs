#!/usr/bin/env node
/**
 * TORGIMA Phase 1A — Complete System Investigation runner (read-only).
 * Outputs JSON to stdout; does not modify code or DB.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "artifacts", "api-server", "src");
const feRoot = path.join(root, "artifacts", "torgima", "src");

const DATABASE_URL =
  (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) ||
  "postgresql://postgres:postgres@127.0.0.1:5432/torgima_test";

function exists(relFromApi) {
  return fs.existsSync(path.join(apiRoot, relFromApi));
}

function grepFile(relFromApi, patterns) {
  const full = path.join(apiRoot, relFromApi);
  if (!fs.existsSync(full)) return { exists: false, matches: {} };
  const text = fs.readFileSync(full, "utf8");
  const matches = {};
  for (const [key, re] of Object.entries(patterns)) {
    matches[key] = re.test(text);
  }
  return { exists: true, matches };
}

function grepDir(relDir, pattern) {
  const hits = [];
  const base = path.join(apiRoot, relDir);
  if (!fs.existsSync(base)) return hits;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
        const t = fs.readFileSync(p, "utf8");
        if (pattern.test(t)) hits.push(path.relative(apiRoot, p).replace(/\\/g, "/"));
      }
    }
  };
  walk(base);
  return hits;
}

function countMatches(relFromApi, pattern) {
  const full = path.join(apiRoot, relFromApi);
  if (!fs.existsSync(full)) return 0;
  const m = fs.readFileSync(full, "utf8").match(new RegExp(pattern, "g"));
  return m ? m.length : 0;
}

async function runDb(client) {
  const out = {};

  const q = async (name, sql) => {
    try {
      const r = await client.query(sql);
      out[name] = { ok: true, rows: r.rows, rowCount: r.rowCount };
    } catch (e) {
      out[name] = { ok: false, error: e.message };
    }
  };

  await q("doc02_tables", `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name NOT LIKE 'erector_%'
    AND table_name NOT LIKE '_drizzle%' AND table_name NOT LIKE 'pg_%'
    ORDER BY table_name`);

  const expectedDoc02 = [
    "users","blueprints","plans","seasons","phases","projects","actions","orders","feedback",
    "signal_snapshots","conditions","enforcement_packages","state_memory","domain_history",
    "targets","milestones","real_outcomes","outcome_validations","false_progress_flags",
    "academy_tasks","academy_proof","capability_profiles","behavior_patterns","behavior_events",
    "identity_history","user_identity_states","reward_events","decision_traces","cognitive_load_scores",
    "events","event_logs","dead_letter_events","bhudhi_logs","bhudhi_memory","blueprint_mutations",
    "system_health_logs","feature_flags","order_dependencies","project_dependencies",
    "knowledge_objects","handoff_tokens","blueprint_policies",
  ];
  const found = new Set((out.doc02_tables.rows ?? []).map((r) => r.table_name));
  out.doc02_summary = {
    expected: expectedDoc02.length,
    present: expectedDoc02.filter((t) => found.has(t)).length,
    missing: expectedDoc02.filter((t) => !found.has(t)),
  };

  await q("erector_tables", `
    SELECT table_name,
      (SELECT COUNT(*) FROM information_schema.columns
       WHERE table_name = t.table_name AND table_schema = 'public') as col_count
    FROM information_schema.tables t
    WHERE table_schema = 'public' AND table_name LIKE 'erector_%'
    ORDER BY table_name`);

  await q("partial_indexes", `
    SELECT indexname, tablename, indexdef FROM pg_indexes
    WHERE indexname IN (
      'one_active_blueprint_per_user','one_current_signal_per_blueprint',
      'one_current_condition_per_blueprint','one_current_enforcement_per_blueprint',
      'one_current_state_memory_per_blueprint','one_current_domain_per_blueprint'
    ) ORDER BY indexname`);

  await q("seed_integrity", `
    SELECT 'threshold_matrix' as tbl, COUNT(*)::int as rows,
      STRING_AGG(tier || ':proceed=' || proceed_min_score::text, ', ' ORDER BY tier) as details
    FROM erector_threshold_matrix
    UNION ALL SELECT 'archetype_rule_packs', COUNT(*)::int,
      STRING_AGG(archetype_id, ', ' ORDER BY archetype_id) FROM erector_archetype_rule_packs
    UNION ALL SELECT 'verdict_rules', COUNT(*) FILTER (WHERE active=true)::int, 'active rules'
    FROM erector_verdict_rules
    UNION ALL SELECT 'model_versions', COUNT(*)::int,
      STRING_AGG(component || '=' || current_version, ', ') FROM erector_model_versions
    UNION ALL SELECT 'false_progress_patterns', COUNT(*)::int,
      STRING_AGG(archetype, ', ') FROM erector_false_progress_patterns
    UNION ALL SELECT 'capability_graph', COUNT(*)::int, 'nodes' FROM erector_capability_graph
    UNION ALL SELECT 'framework_veto_rules', COUNT(*)::int,
      STRING_AGG(framework_id, ', ') FROM erector_framework_veto_rules`);

  await q("feature_flags", `SELECT feature_name, enabled FROM feature_flags ORDER BY feature_name`);

  await q("handoff_columns", `
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'handoff_tokens' ORDER BY ordinal_position`);

  await q("blueprint_archetypes", `
    SELECT b.id, b.erector_archetype, b.erector_state, b.blueprint_source, u.dashboard_mode
    FROM blueprints b JOIN users u ON u.id = b.user_id
    WHERE b.erector_archetype IS NOT NULL LIMIT 5`);

  await q("signal_snapshots_current", `
    SELECT blueprint_id, completion_rate, weighted_score, momentum, trend, is_current, computed_at
    FROM signal_snapshots WHERE is_current = true ORDER BY computed_at DESC LIMIT 5`);

  await q("conditions_current", `
    SELECT c.blueprint_id, c.condition, c.is_current, c.created_at, u.email
    FROM conditions c JOIN blueprints b ON b.id = c.blueprint_id
    JOIN users u ON u.id = b.user_id WHERE c.is_current = true
    ORDER BY c.created_at DESC LIMIT 5`);

  await q("enforcement_current", `
    SELECT ep.blueprint_id, ep.condition, ep.task_limits, ep.difficulty_cap, ep.is_current, ep.created_at
    FROM enforcement_packages ep WHERE ep.is_current = true
    ORDER BY ep.created_at DESC LIMIT 5`);

  await q("bhudhi_logs_stats", `
    SELECT request_type, COUNT(*)::int as calls, AVG(tokens_used) as avg_tokens, MAX(created_at) as latest_call
    FROM bhudhi_logs GROUP BY request_type ORDER BY latest_call DESC LIMIT 20`);

  await q("events_stats", `
    SELECT event_type, status, COUNT(*)::int as count, MAX(created_at) as latest
    FROM events GROUP BY event_type, status ORDER BY latest DESC LIMIT 25`);

  await q("dead_letter_latest", `
    SELECT event_type, failure_reason, retry_count, created_at
    FROM dead_letter_events ORDER BY created_at DESC LIMIT 10`);

  await q("orders_latest", `
    SELECT o.blueprint_id, o.status, o.task_type, o.difficulty, o.created_at,
      b.erector_archetype, b.erector_state
    FROM orders o JOIN blueprints b ON b.id = o.blueprint_id
    ORDER BY o.created_at DESC LIMIT 10`);

  await q("system_health_logs", `
    SELECT status, check_type, COUNT(*)::int, MAX(created_at) as latest
    FROM system_health_logs GROUP BY status, check_type ORDER BY latest DESC LIMIT 20`);

  await q("erector_errors", `
    SELECT error_type, source_engine, COUNT(*)::int as count, MAX(created_at) as latest
    FROM erector_system_error_records GROUP BY error_type, source_engine
    ORDER BY latest DESC LIMIT 20`);

  await q("erector_signals_stats", `
    SELECT signal_type, COUNT(*)::int, MAX(generated_at) as latest
    FROM erector_signals GROUP BY signal_type ORDER BY signal_type`);

  await q("manual_migration_ledger", `
    SELECT filename FROM _manual_migration_ledger ORDER BY filename`);

  return out;
}

function runCodeAudit() {
  const engines = {
    DOC10_FeedbackProcessing: {
      ProofValidator: exists("engines/execution-loop/feedback/ProofValidator.ts"),
      GamingDetector: exists("engines/execution-loop/feedback/GamingDetector.ts"),
      InterrogationEngine: exists("engines/execution-loop/feedback/InterrogationEngine.ts"),
      BlockerClassifier: exists("engines/execution-loop/feedback/BlockerClassifier.ts"),
      FeedbackVerdictEngine: exists("engines/execution-loop/feedback/FeedbackVerdictEngine.ts"),
    },
    DOC11_Inactivity: {
      InactivityDetectionEngine: exists("engines/inactivity/InactivityDetectionEngine.ts"),
      RecoveryPathSelector: exists("engines/inactivity/RecoveryPathSelector.ts"),
    },
    DOC12_BhudhiTriggerRouter: {
      TriggerRegistry: exists("lib/bhudhi/TriggerRegistry.ts"),
      BhudhiTriggerRouter: exists("lib/bhudhi/BhudhiTriggerRouter.ts"),
      OutputValidator: exists("lib/bhudhi/OutputValidator.ts"),
    },
    DOC13_PromptLibrary: {
      PromptContracts: exists("lib/bhudhi/prompts/PromptContracts.ts"),
      OutputSchemas: exists("lib/bhudhi/schemas/OutputSchemas.ts"),
      FallbackLibrary: exists("lib/bhudhi/FallbackLibrary.ts"),
    },
    DOC14_Memory: {
      BhudhiMemoryService: exists("lib/bhudhi/BhudhiMemoryService.ts"),
      BudgetController: exists("lib/bhudhi/BudgetController.ts"),
    },
    DOC15_StateMutation: {
      StateMutationService: exists("services/StateMutationService.ts"),
      BlueprintVersionWriter: exists("engines/state/BlueprintVersionWriter.ts"),
    },
    DOC16_WorkerRegistry: { WorkerRegistry: exists("workers/WorkerRegistry.ts") },
    DOC17_StateIntegrity: {
      StateIntegrityEngine: exists("engines/integrity/StateIntegrityEngine.ts"),
      SystemHealthMonitor: exists("engines/health/SystemHealthMonitor.ts"),
    },
    DOC18_Identity: { IdentityEngine: exists("engines/identity/IdentityEngine.ts") },
    DOC19_Reward: { RewardEngine: exists("engines/reward/RewardEngine.ts") },
    DOC20_Outcome: { OutcomeValidationEngine: exists("engines/outcome/OutcomeValidationEngine.ts") },
    DOC21_Pattern: { PatternLearningEngine: exists("engines/pattern/PatternLearningEngine.ts") },
    DOC22_Failure: { FailureClassificationEngine: exists("engines/intelligence/FailureClassificationEngine.ts") },
    DOC23_DecisionTrace: { DecisionTraceService: exists("services/DecisionTraceService.ts") },
    DOC24_Priority: { PriorityEngine: exists("engines/priority/RealTimePriorityEngine.ts") },
    DOC25_Friction: { FrictionDetectionEngine: exists("engines/friction/FrictionDetectionEngine.ts") },
    DOC26_Dependency: { DependencyEngine: exists("engines/dependency/DependencyEngine.ts") },
    DOC27_ExternalSignal: { ExternalSignalProcessor: exists("engines/external-signal/ExternalSignalGateway.ts") },
    DOC28_Orchestration: { OrchestrationService: exists("engines/orchestration/OrchestrationService.ts") },
  };

  const engineWiring = {
    feedback_submitted: grepDir("workers", /feedback_submitted|FEEDBACK_SUBMITTED/),
    signal_calculated: grepDir("workers", /signal_calculated|SIGNAL_CALCULATED/),
    condition_evaluated: grepDir("workers", /condition_evaluated|CONDITION_EVALUATED/),
    task_generation_requested: grepDir("workers", /task_generation_requested|TASK_GENERATION_REQUESTED/),
    order_available: grepDir("workers", /order_available|ORDER_AVAILABLE/),
    bhudhi_trigger: grepDir("engines", /routeBhudhiRequest|BhudhiTriggerRouter/),
  };

  const section2 = {
    free_route: grepFile("routes/erector/free.ts", {
      route: /\/free\/validate/,
      industry: /industry/,
      budget_range: /budget_range/,
      timeline: /timeline/,
      fingerprint: /fingerprint/,
      rate_limit_3: /FREE_VALIDATION_LIMIT\s*=\s*3/,
    }),
    free_scoring: grepFile("engines/erector/ValidationScoringEngine.ts", {
      scoreDimensionsForFreeTier: /scoreDimensionsForFreeTier/,
      is_free_tier_preview: /is_free_tier_preview/,
    }),
    free_thresholds: grepFile("engines/erector/RuleConflictResolver.ts", {
      resolveFreeTierConflicts: /resolveFreeTierConflicts/,
    }),
    intake_pipeline: grepFile("services/erector/intake/IntakePipeline.ts", {
      runIntakePipeline: /runIntakePipeline/,
      IntakeNormalizer: /IntakeNormalizer/,
      ContradictionDetector: /ContradictionDetector/,
      AmbiguityDetector: /AmbiguityDetector/,
      MissingFieldDetector: /MissingFieldDetector/,
    }),
    economic_engine: grepFile("engines/erector/economic/EconomicTypeEngine.ts", {
      classifyEconomicType: /classifyEconomicType/,
    }),
    archetype_count: countMatches(
      "engines/erector/economic/EconomicTypeClassifier.ts",
      "marketplace_exchange|direct_service_delivery|saas_platform|content_media|consulting_advisory|subscription_recurring|physical_product|information_knowledge|social_enterprise|collective_community",
    ),
    rule_engine: grepFile("engines/erector/ErectorRuleEngine.ts", {
      evaluateRules: /evaluateRules/,
      HARD_BLOCKER: /HARD_BLOCKER/,
    }),
    conflict_resolver: grepFile("engines/erector/RuleConflictResolver.ts", {
      resolveConflicts: /resolveConflicts/,
    }),
    orchestrator: grepFile("engines/erector/ErectorValidationOrchestrator.ts", {
      runValidationOrchestrator: /runValidationOrchestrator/,
    }),
    launch_gate: grepFile("services/BlueprintLaunchService.ts", {
      enforceLaunchContract: /enforceLaunchContract/,
      injectErectorIntelligence: /injectErectorIntelligence/,
      dashboard_mode_full: /dashboard_mode.*full/,
    }),
    state_machine: grepFile("engines/erector/erectorStateMachine.ts", {
      ErectorStateMachine: /VALID_TRANSITIONS|updateBlueprintErectorState/,
    }),
    handoff: grepFile("services/handoff-service.ts", {
      createHandoffToken: /createHandoffToken/,
      expires_at: /expires_at/,
      consumed: /consumed/,
    }),
    handoff_prefill: grepFile("services/erector/intake/HandoffSectionPrefill.ts", {
      buildSection1: /buildSection1FromHandoff/,
      buildSection3: /buildSection3FromHandoff/,
      buildSection5: /buildSection5FromHandoff/,
    }),
    task_generation: grepFile("engines/task-generation/TaskGenerationEngine.ts", {
      loadArchetypeContext: /loadArchetypeContext/,
      false_progress: /isArchetypeFalseProgressRisk/,
      TASK_DRAFTING: /TASK_DRAFTING|routeBhudhiRequest/,
    }),
    guarantee_engine: exists("engines/task-guarantee/ContinuousTaskGuaranteeEngine.ts"),
    signal_engine: grepFile("engines/execution-loop/SignalCalculationEngine.ts", {
      calculateSignals: /calculateSignals|SignalCalculationEngine/,
    }),
    condition_engine: grepFile("engines/execution-loop/ConditionEvaluationEngine.ts", {
      evaluateCondition: /evaluateCondition|ConditionEvaluationEngine/,
    }),
    control_engine: grepFile("engines/execution-loop/ControlEngine.ts", {
      enforcement_package: /enforcement_package|ControlEngine/,
    }),
    erector_signal_bridge: grepFile("workers/WorkerRegistry.ts", {
      ErectorSignalBridgeWorker: /ErectorSignalBridgeWorker/,
    }),
    orchestration: grepFile("engines/orchestration/OrchestrationService.ts", {
      OrchestrationService: /OrchestrationService/,
      FEEDBACK_COMPLETION: /FEEDBACK_COMPLETION/,
    }),
  };

  const bhudhi = {
    doc12_triggers: (() => {
      const f = path.join(apiRoot, "lib/bhudhi/TriggerRegistry.ts");
      const t = fs.readFileSync(f, "utf8");
      const expected = [
        "GOAL_STRUCTURING","TASK_DRAFTING","BLOCKER_CLASSIFICATION","STATE_EXPLANATION",
        "RECOVERY_COPY","ACADEMY_SUPPORT","ROOT_CAUSE_ASSIST","OUTCOME_EVIDENCE_SUMMARY",
        "PROOF_RELEVANCE_CHECK","ERECTOR_VERDICT_EXPLAIN","ERECTOR_FREE_VERDICT_EXPLAIN",
      ];
      return Object.fromEntries(expected.map((k) => [k, t.includes(k)]));
    })(),
    erector_triggers_in_registerErector: (() => {
      const f = path.join(apiRoot, "bhudhi/registerErectorValidationPrompts.ts");
      if (!fs.existsSync(f)) return {};
      const t = fs.readFileSync(f, "utf8");
      return {
        ERECTOR_FREE_VALIDATION: t.includes("ERECTOR_FREE_VALIDATION"),
        ERECTOR_FREE_VERDICT_EXPLAIN: t.includes("ERECTOR_FREE_VERDICT_EXPLAIN"),
        ERECTOR_VERDICT_EXPLANATION: t.includes("ERECTOR_VERDICT_EXPLANATION"),
      };
    })(),
    direct_anthropic_calls: (() => {
      const hits = [];
      const walk = (dir) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, ent.name);
          if (ent.isDirectory() && ent.name !== "node_modules" && ent.name !== "tests") walk(p);
          else if (ent.name.endsWith(".ts") && !ent.name.includes(".test.")) {
            const t = fs.readFileSync(p, "utf8");
            if (/anthropic\.messages\.create|new Anthropic\(\)|api\.anthropic\.com/.test(t)) {
              hits.push(path.relative(apiRoot, p).replace(/\\/g, "/"));
            }
          }
        }
      };
      walk(apiRoot);
      return hits;
    })(),
    budget_controller: grepFile("lib/bhudhi/BudgetController.ts", {
      checkAndReserve: /checkAndReserve/,
      starter_20: /starter.*20|20.*starter/i,
      growth_50: /growth.*50|50.*growth/i,
      ultimate_100: /ultimate.*100|100.*ultimate/i,
    }),
  };

  const security = {
    auth_middleware_refs: (() => {
      let n = 0;
      const walk = (dir) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) walk(p);
          else if (ent.name.endsWith(".ts")) {
            const t = fs.readFileSync(p, "utf8");
            if (/requireAuth|authMiddleware|getUser/.test(t)) n++;
          }
        }
      };
      walk(path.join(apiRoot, "routes"));
      return n;
    })(),
    law1_bhudhi_decides: grepDir("engines", /bhudhiResult\.verdict|bhudhi.*condition.*set/),
    law2_bhudhi_in_signal: (() => {
      const f = path.join(apiRoot, "engines/execution-loop/SignalCalculationEngine.ts");
      if (!fs.existsSync(f)) return false;
      return /BhudhiTriggerRouter|routeBhudhiRequest/.test(fs.readFileSync(f, "utf8"));
    })(),
    law3_launch_gate: grepFile("services/BlueprintLaunchService.ts", { gate: /enforceLaunchContract/ }),
    law4_guarantee: grepFile("engines/task-guarantee/ContinuousTaskGuaranteeEngine.ts", {
      fallback: /fallback|guarantee|never.*empty|always.*task/i,
    }),
    rate_limiting: grepDir("middleware", /rateLimit|rateLimiter/).concat(
      grepDir("routes", /rateLimit|rateLimiter|FREE_VALIDATION_LIMIT|checkValidationRateLimit/),
    ),
  };

  const frontend = {
    limited_variants: {
      VariantA: fs.existsSync(path.join(feRoot, "components/dashboard/LimitedDashboard/VariantA_PostFreeValidation.tsx")),
      VariantB: fs.existsSync(path.join(feRoot, "components/dashboard/LimitedDashboard/VariantB_DirectSignup.tsx")),
      VariantC: fs.existsSync(path.join(feRoot, "components/dashboard/LimitedDashboard/VariantC_IntakeInProgress.tsx")),
    },
    screens: {
      login: fs.existsSync(path.join(feRoot, "pages/login.tsx")),
      signup: fs.existsSync(path.join(feRoot, "pages/signup.tsx")),
      onboarding: fs.existsSync(path.join(feRoot, "pages/onboarding.tsx")),
      validation_results: fs.existsSync(path.join(feRoot, "pages/validation-results.tsx")),
      path_selection: fs.existsSync(path.join(feRoot, "pages/onboarding/select-blueprint.tsx")),
      dashboard: fs.existsSync(path.join(feRoot, "pages/dashboard.tsx")),
      task: fs.existsSync(path.join(feRoot, "pages/task.tsx")),
      feedback: fs.existsSync(path.join(feRoot, "pages/feedback.tsx")),
      signals: fs.existsSync(path.join(feRoot, "pages/signals.tsx")),
      identity: fs.existsSync(path.join(feRoot, "pages/identity.tsx")),
      outcomes: fs.existsSync(path.join(feRoot, "pages/growth.tsx")),
    },
    language_map: (() => {
      const f = path.join(feRoot, "lib/language-map.ts");
      if (!fs.existsSync(f)) return { exists: false };
      const t = fs.readFileSync(f, "utf8");
      return {
        exists: true,
        condition_refs: (t.match(/nothingness|danger|urgency|stability|power|affluence/g) ?? []).length,
        identity_refs: (t.match(/UNFORMED|INITIATING|BUILDING|STABILIZING|EXPANDING|INTEGRATED|REGRESSING|RESTARTING/g) ?? []).length,
      };
    })(),
    state_version: (() => {
      const f = path.join(feRoot, "lib/api-client.ts");
      if (!fs.existsSync(f)) return false;
      return /stateVersion|X-State-Version|expectedStateVersion|STALE_STATE/.test(fs.readFileSync(f, "utf8"));
    })(),
  };

  const testDirs = {
    erector: fs.existsSync(path.join(apiRoot, "tests/erector"))
      ? fs.readdirSync(path.join(apiRoot, "tests/erector")).length
      : 0,
    engines: fs.existsSync(path.join(apiRoot, "tests/engines"))
      ? fs.readdirSync(path.join(apiRoot, "tests/engines")).length
      : 0,
    bhudhi: fs.existsSync(path.join(apiRoot, "tests/bhudhi"))
      ? fs.readdirSync(path.join(apiRoot, "tests/bhudhi")).length
      : 0,
  };

  const workerCount = Object.keys(
    JSON.parse(
      fs
        .readFileSync(path.join(apiRoot, "workers/WorkerRegistry.ts"), "utf8")
        .match(/WORKER_REGISTRY[^=]*=\s*\{([\s\S]*?)\} as const/)?.[0]
        ?.replace(/ as const$/, "") ?? "{}",
    ),
  ).length;

  // Fallback worker count
  const workerRegistryMatches = (fs.readFileSync(path.join(apiRoot, "workers/WorkerRegistry.ts"), "utf8").match(/^\s+\w+Worker:/gm) ?? []).length;

  const dbCiPipeline = {
    package_json_db_ci: fs.readFileSync(path.join(root, "package.json"), "utf8").includes('"db:ci"'),
    includes_partial_indexes: fs.readFileSync(path.join(root, "package.json"), "utf8").includes("apply-partial-indexes"),
    includes_erector_seed: fs.readFileSync(path.join(root, "package.json"), "utf8").includes("erector-seed"),
    seed_module_exists: fs.existsSync(path.join(root, "lib/db/src/erector-seed.ts")),
    partial_indexes_sql_exists: fs.existsSync(path.join(root, "scripts/apply-partial-indexes.sql")),
    erector_seed_sql_in_root_migrations: fs.existsSync(path.join(root, "migrations/0043_erector_schema_1_seed_data.sql")),
  };

  return {
    engines,
    engineWiring,
    section2,
    bhudhi,
    security,
    frontend,
    testDirs,
    workerRegistryCount: workerRegistryMatches,
    dbCiPipeline,
  };
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const db = await runDb(client);
  await client.end();

  const code = runCodeAudit();

  const report = {
    generatedAt: new Date().toISOString(),
    databaseUrl: DATABASE_URL.replace(/:[^:@]+@/, ":***@"),
    db,
    code,
  };

  const outPath = path.join(root, "TORGIMA_PHASE1A_INVESTIGATION.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`\n[phase1a] Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
