-- User-facing project display name (distinct from internal sprint "projects" table)
ALTER TABLE blueprints
ADD COLUMN IF NOT EXISTS project_name TEXT;

COMMENT ON COLUMN blueprints.project_name IS 'User-chosen display name for the active blueprint/project';
