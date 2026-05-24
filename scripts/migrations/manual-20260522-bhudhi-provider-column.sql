-- Bhudhi dual-provider routing (Gemini validation + Claude execution)
ALTER TABLE bhudhi_logs ADD COLUMN IF NOT EXISTS provider text DEFAULT 'claude';
