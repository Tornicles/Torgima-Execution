-- Prompt 4: Erector → Execution Bridge
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'smoke_test';

ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS blueprint_tier text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS industry_state text;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS archetype_execution_mult double precision;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS archetype_timeframe_mult double precision;
ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS archetype_difficulty_adj double precision;
