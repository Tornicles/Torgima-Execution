-- Erector validation: competitor deep intelligence + panel explanation paragraphs

ALTER TABLE validation_competitors
  ADD COLUMN IF NOT EXISTS competitor_archetype TEXT
    CHECK (competitor_archetype IN ('pioneer', 'fast_mover', 'indie_survivor')),
  ADD COLUMN IF NOT EXISTS revenue_lifecycle JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS marketing_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS growth_catalyst JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS first_product_origin JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS digital_footprint JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE validation_runs
  ADD COLUMN IF NOT EXISTS explanation_paragraphs JSONB NOT NULL DEFAULT '{}'::jsonb;
