-- Bhudhi DOC4 STEP 1 — research cache, usage budget, web search columns on bhudhi_logs
-- Idempotent: safe to re-run on environments that already applied Supabase migration bhudhi_schema_upgrade

CREATE TABLE IF NOT EXISTS bhudhi_research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  research_type TEXT NOT NULL,
  result_json JSONB NOT NULL,
  sources JSONB DEFAULT '[]',
  confidence TEXT NOT NULL,
  tokens_used INTEGER,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bhudhi_usage_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_utc TEXT NOT NULL,
  tier TEXT NOT NULL,
  total_calls INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_cents DOUBLE PRECISION DEFAULT 0,
  calls_by_trigger JSONB DEFAULT '{}',
  budget_exhausted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bhudhi_budget_user_date
  ON bhudhi_usage_budget(user_id, date_utc);

ALTER TABLE bhudhi_logs
  ADD COLUMN IF NOT EXISTS web_search_used BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS search_queries JSONB DEFAULT '[]';
