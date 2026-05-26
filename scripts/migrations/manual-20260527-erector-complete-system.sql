-- TORGIMA_ERECTOR_COMPLETE_SYSTEM.docx — additive only

-- Blueprint refinement (10 fields)
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_goal_input TEXT;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS goal_options JSONB;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selected_goal_index INTEGER;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_purpose_input TEXT;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS purpose_options JSONB;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selected_purpose_index INTEGER;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS refinement_status TEXT DEFAULT 'pending';
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS economic_type TEXT;

-- Validation feed + 20 stage outputs + workspace + paths + handoff
ALTER TABLE validations ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS timeframe_start TIMESTAMPTZ;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS timeframe_end TIMESTAMPTZ;

ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_purpose_decomposition JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_economic_resolution JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_business_patterns JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_economy_timing JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_market_analysis JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_social_channels JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_pros JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_cons JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_feasibility JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_viability JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_bootstrap JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_features JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_customer_definition JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_positioning JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_difficulty JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_revenue_path JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_first_90_days JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_execution_paths JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS stage_final_decision TEXT;

ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_version INTEGER DEFAULT 1;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS validation_history JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS user_edits JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS pending_changes JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

ALTER TABLE validations ADD COLUMN IF NOT EXISTS path_foundation JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS path_momentum JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS path_overdrive JSONB;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS selected_execution_path TEXT;
ALTER TABLE validations ADD COLUMN IF NOT EXISTS handoff_package JSONB;
