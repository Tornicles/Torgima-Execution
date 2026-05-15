import { pool } from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Idempotent schema patches for production DBs that predate manual migrations.
 * Safe to run on every API boot.
 */
const PATCH_STATEMENTS: string[] = [
  `DO $$ BEGIN
    ALTER TYPE blueprint_status ADD VALUE IF NOT EXISTS 'awaiting_selection';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TYPE blueprint_status ADD VALUE IF NOT EXISTS 'path_selection';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$ BEGIN
    CREATE TYPE validation_readiness AS ENUM (
      'not_ready', 'partial', 'ready_proceed', 'ready_with_adjustment', 'blocked_pivot'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS tier user_tier`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS intelligence_payload jsonb`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS blueprint_contract jsonb`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS launch_blocked boolean NOT NULL DEFAULT false`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS adjusted_path_confirmed boolean NOT NULL DEFAULT false`,
  `ALTER TABLE validations ADD COLUMN IF NOT EXISTS readiness validation_readiness`,

  `ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS tier user_tier`,
  `ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selection_confirmed_at TIMESTAMPTZ`,
  `ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS blueprint_config JSONB NOT NULL DEFAULT '{}'::jsonb`,

  `CREATE TABLE IF NOT EXISTS validation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    validation_id UUID REFERENCES validations(id),
    goal_hash TEXT NOT NULL,
    raw_goal_snapshot TEXT,
    verdict TEXT,
    clarity_score DOUBLE PRECISION,
    feasibility_score DOUBLE PRECISION,
    realism_score DOUBLE PRECISION,
    industry_label TEXT,
    selected_path TEXT,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS strategic_assumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    validation_id UUID REFERENCES validations(id),
    assumption_text TEXT NOT NULL,
    industry_context TEXT,
    monitoring_status TEXT NOT NULL DEFAULT 'active',
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS validation_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_id UUID NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    confidence INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS eis_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    industry TEXT NOT NULL,
    niche TEXT NOT NULL,
    last_call_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cached_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS eis_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blueprint_id UUID REFERENCES blueprints(id),
    validation_id UUID REFERENCES validations(id),
    industry TEXT,
    niche TEXT,
    tokens_used INTEGER,
    estimated_cost_usd DOUBLE PRECISION,
    model_used TEXT,
    cache_hit BOOLEAN NOT NULL DEFAULT false,
    low_confidence BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `ALTER TABLE dead_letter_events
    ADD COLUMN IF NOT EXISTS failure_class TEXT NOT NULL DEFAULT 'transient'`,
  `ALTER TABLE dead_letter_events
    ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'OPEN'`,
  `ALTER TABLE dead_letter_events
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`,
];

export async function ensureSchemaPatches(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const sql of PATCH_STATEMENTS) {
      await client.query(sql);
    }
    logger.info("[Schema] Idempotent patches applied");
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "[Schema] Patch failed — validation may error until migrations are applied manually",
    );
  } finally {
    client.release();
  }
}
