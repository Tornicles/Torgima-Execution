-- Prompt 3: Ultimate features (Sequence 25 — predictions, scene, validation, emergency orders)

CREATE TABLE IF NOT EXISTS ultimate_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  predicted_task text NOT NULL,
  predicted_blockers text[] NOT NULL DEFAULT ARRAY[]::text[],
  predicted_duration integer,
  task_confidence double precision NOT NULL,
  blocker_risk double precision NOT NULL,
  accuracy_history double precision NOT NULL DEFAULT 0.5,
  actual_task text,
  actual_blockers text[] NOT NULL DEFAULT ARRAY[]::text[],
  prediction_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ultimate_predictions_blueprint_id ON ultimate_predictions(blueprint_id);

CREATE TABLE IF NOT EXISTS ultimate_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  current_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ideal_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_vs_expected double precision NOT NULL,
  expected_vs_ideal double precision NOT NULL,
  blocker_gaps text[] NOT NULL DEFAULT ARRAY[]::text[],
  opportunity_gaps text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ultimate_scenes_blueprint_id ON ultimate_scenes(blueprint_id);

CREATE TABLE IF NOT EXISTS ultimate_validation_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  execution_valid boolean NOT NULL,
  prediction_valid boolean NOT NULL,
  scene_valid boolean NOT NULL,
  validation_errors text[] NOT NULL DEFAULT ARRAY[]::text[],
  warnings text[] NOT NULL DEFAULT ARRAY[]::text[],
  recovery_needed boolean NOT NULL DEFAULT false,
  recovery_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ultimate_validation_checkpoints_blueprint_id
  ON ultimate_validation_checkpoints(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_ultimate_validation_checkpoints_recovery
  ON ultimate_validation_checkpoints(recovery_needed);

CREATE TABLE IF NOT EXISTS ultimate_emergency_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  trigger_event text NOT NULL,
  order_type text NOT NULL,
  task_description text NOT NULL,
  urgency text NOT NULL,
  estimated_impact text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  linked_order_id uuid,
  completed_at timestamptz,
  effectiveness double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ultimate_emergency_orders_blueprint_id ON ultimate_emergency_orders(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_ultimate_emergency_orders_status ON ultimate_emergency_orders(status);
CREATE INDEX IF NOT EXISTS idx_ultimate_emergency_orders_trigger ON ultimate_emergency_orders(trigger_event);
