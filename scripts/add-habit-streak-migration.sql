-- Prompt 14: habit streak tracking (run against Postgres after deploy)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0;
