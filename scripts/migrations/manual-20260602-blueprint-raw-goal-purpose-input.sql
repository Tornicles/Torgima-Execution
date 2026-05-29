-- Production repair: blueprint erector refinement columns (Railway 42703 raw_goal_input).
-- Additive only — safe to re-run (IF NOT EXISTS).

ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_goal_input text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS raw_purpose_input text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS goal_options jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selected_goal_index integer;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS purpose_options jsonb;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS selected_purpose_index integer;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS refinement_status text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS economic_type text;
