-- Enriched validation intelligence columns for results UI and PDF reports
ALTER TABLE validations
  ADD COLUMN IF NOT EXISTS economic_context JSONB,
  ADD COLUMN IF NOT EXISTS enriched_competitors JSONB,
  ADD COLUMN IF NOT EXISTS enriched_opportunities JSONB,
  ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_url TEXT;
