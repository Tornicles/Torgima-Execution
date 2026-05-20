-- Bhudhi B3: memory summary columns (DOC_14 §6–10)
ALTER TABLE bhudhi_memory
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS relevance_score double precision NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

ALTER TABLE bhudhi_memory
  ALTER COLUMN content_json SET DEFAULT '{}'::jsonb;

UPDATE bhudhi_memory
SET content = COALESCE(
  content,
  content_json->>'text',
  NULLIF(content_json::text, '{}')
)
WHERE content IS NULL AND content_json IS NOT NULL;

UPDATE bhudhi_memory
SET relevance_score = COALESCE(relevance_score, confidence, 0.5)
WHERE relevance_score IS NULL OR relevance_score = 0.5;
