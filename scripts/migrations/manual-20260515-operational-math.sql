-- Add operational mathematics payload to signal snapshots (deterministic engine output).
-- Apply with: psql $DATABASE_URL -f scripts/migrations/manual-20260515-operational-math.sql
-- Or rely on: pnpm -F @workspace/db push

ALTER TABLE signal_snapshots
  ADD COLUMN IF NOT EXISTS operational_mathematics_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN signal_snapshots.operational_mathematics_json IS 'Deterministic SignalOperationalMathematicsEngine output (versioned JSON).';
