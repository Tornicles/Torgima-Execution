-- GAP G6 — feedback late penalty flag for behavior detection

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS late_penalty_applied BOOLEAN NOT NULL DEFAULT false;
