-- Blueprint hierarchy pointer columns (idempotent; aligns with lib/db schema).

ALTER TABLE blueprints
  ADD COLUMN IF NOT EXISTS current_plan_id UUID,
  ADD COLUMN IF NOT EXISTS current_phase_id UUID,
  ADD COLUMN IF NOT EXISTS current_project_id UUID,
  ADD COLUMN IF NOT EXISTS current_action_id UUID;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS action_id UUID,
  ADD COLUMN IF NOT EXISTS plan_id UUID,
  ADD COLUMN IF NOT EXISTS phase_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS linked_plan_id UUID,
  ADD COLUMN IF NOT EXISTS linked_target_id UUID,
  ADD COLUMN IF NOT EXISTS linked_phase_id UUID,
  ADD COLUMN IF NOT EXISTS linked_project_id UUID;

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE phases
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE targets
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
