-- Erector Validation System: economy archetypes, validation columns, blueprint references.

ALTER TYPE bhudhi_trigger_type ADD VALUE IF NOT EXISTS 'erector_analysis';

CREATE TABLE IF NOT EXISTS economic_archetypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype_number integer NOT NULL UNIQUE,
  name text NOT NULL,
  countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  institutional_strength double precision NOT NULL,
  corruption_index double precision NOT NULL,
  infrastructure_quality double precision NOT NULL,
  digital_adoption double precision NOT NULL,
  consumer_purchasing_power double precision NOT NULL,
  startup_ecosystem_maturity double precision NOT NULL,
  regulatory_openness double precision NOT NULL,
  political_stability double precision NOT NULL,
  labor_market_flexibility double precision NOT NULL,
  market_competition_density double precision NOT NULL,
  consumer_behavior_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  typical_resistance_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  survivor_behavior_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  cultural_business_norms jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_risk_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_opportunity_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeframe_pressure_multiplier double precision NOT NULL DEFAULT 1,
  execution_intensity_multiplier double precision NOT NULL DEFAULT 1,
  blueprint_difficulty_adjustment double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_economic_archetypes_number ON economic_archetypes(archetype_number);

ALTER TABLE validations
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS location_country text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS budget_available double precision,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS current_resources jsonb,
  ADD COLUMN IF NOT EXISTS target_customer text,
  ADD COLUMN IF NOT EXISTS desired_outcome text,
  ADD COLUMN IF NOT EXISTS known_blockers jsonb,
  ADD COLUMN IF NOT EXISTS commitment_level text,
  ADD COLUMN IF NOT EXISTS market_score double precision,
  ADD COLUMN IF NOT EXISTS execution_score double precision,
  ADD COLUMN IF NOT EXISTS timing_score double precision,
  ADD COLUMN IF NOT EXISTS competition_score double precision,
  ADD COLUMN IF NOT EXISTS scalability_score double precision,
  ADD COLUMN IF NOT EXISTS local_economy_score double precision,
  ADD COLUMN IF NOT EXISTS resource_score double precision,
  ADD COLUMN IF NOT EXISTS blueprint_difficulty_score double precision,
  ADD COLUMN IF NOT EXISTS risk_score double precision,
  ADD COLUMN IF NOT EXISTS momentum_potential double precision,
  ADD COLUMN IF NOT EXISTS trust_building_score double precision,
  ADD COLUMN IF NOT EXISTS reality_score double precision,
  ADD COLUMN IF NOT EXISTS archetype_resolution jsonb,
  ADD COLUMN IF NOT EXISTS purpose_decomposition jsonb,
  ADD COLUMN IF NOT EXISTS industry_intelligence jsonb,
  ADD COLUMN IF NOT EXISTS market_analysis jsonb,
  ADD COLUMN IF NOT EXISTS competitor_analysis jsonb,
  ADD COLUMN IF NOT EXISTS economy_briefing jsonb,
  ADD COLUMN IF NOT EXISTS customer_pain_analysis jsonb,
  ADD COLUMN IF NOT EXISTS timing_analysis jsonb,
  ADD COLUMN IF NOT EXISTS execution_difficulty jsonb,
  ADD COLUMN IF NOT EXISTS time_simulations jsonb,
  ADD COLUMN IF NOT EXISTS industry_pros jsonb,
  ADD COLUMN IF NOT EXISTS industry_cons jsonb,
  ADD COLUMN IF NOT EXISTS winner_analysis jsonb,
  ADD COLUMN IF NOT EXISTS first_week_plan jsonb,
  ADD COLUMN IF NOT EXISTS recommended_blueprint_level text,
  ADD COLUMN IF NOT EXISTS erector_payload jsonb,
  ADD COLUMN IF NOT EXISTS erector_validation_stage text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS validation_stage text NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_validations_idempotency_key ON validations(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS validation_archetype_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id uuid NOT NULL REFERENCES validations(id) ON DELETE CASCADE,
  archetype_id uuid NOT NULL REFERENCES economic_archetypes(id),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_archetype_maps_validation_id ON validation_archetype_maps(validation_id);

ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS erector_validation_id uuid,
  ADD COLUMN IF NOT EXISTS primary_archetype_id uuid REFERENCES economic_archetypes(id),
  ADD COLUMN IF NOT EXISTS reality_score double precision,
  ADD COLUMN IF NOT EXISTS chosen_blueprint_level text,
  ADD COLUMN IF NOT EXISTS economy_briefing_summary text;
