-- Prompt 2: Growth features (Sequence 24 — interrogation, knowledge, adaptation, patterns)

CREATE TABLE IF NOT EXISTS interrogation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  question text NOT NULL,
  context text NOT NULL,
  user_answer text,
  category text NOT NULL,
  insight_extracted text,
  insight_actionable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interrogation_logs_blueprint_id ON interrogation_logs(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_interrogation_logs_sequence_number ON interrogation_logs(sequence_number);

CREATE TABLE IF NOT EXISTS knowledge_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  tier text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  relevant_at_seq integer,
  keyword_triggers text[] NOT NULL DEFAULT ARRAY[]::text[],
  viewed_count integer NOT NULL DEFAULT 0,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_knowledge_cards_blueprint_title ON knowledge_cards(blueprint_id, title);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_blueprint_id ON knowledge_cards(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_tier ON knowledge_cards(tier);

CREATE TABLE IF NOT EXISTS adaptation_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  pattern_detected text NOT NULL,
  category text NOT NULL,
  current_behavior text NOT NULL,
  suggested_change text NOT NULL,
  reasoning text NOT NULL,
  confidence double precision NOT NULL,
  user_applied boolean NOT NULL DEFAULT false,
  applied_date timestamptz,
  effectiveness double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adaptation_suggestions_blueprint_id ON adaptation_suggestions(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_adaptation_suggestions_sequence_number ON adaptation_suggestions(sequence_number);

CREATE TABLE IF NOT EXISTS growth_execution_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  pattern_name text NOT NULL,
  detected_at_seq integer NOT NULL,
  occurrence_count integer NOT NULL,
  confidence double precision NOT NULL,
  impact text,
  is_learnable boolean NOT NULL DEFAULT true,
  suggested_fix text,
  last_observed timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_growth_execution_patterns_blueprint_type_name
  ON growth_execution_patterns(blueprint_id, pattern_type, pattern_name);
CREATE INDEX IF NOT EXISTS idx_growth_execution_patterns_blueprint_id ON growth_execution_patterns(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_growth_execution_patterns_pattern_type ON growth_execution_patterns(pattern_type);
