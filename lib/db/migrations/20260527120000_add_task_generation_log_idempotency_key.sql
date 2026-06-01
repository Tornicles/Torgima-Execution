ALTER TABLE task_generation_log
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_generation_log_idempotency_key
ON task_generation_log(idempotency_key)
WHERE idempotency_key IS NOT NULL;
