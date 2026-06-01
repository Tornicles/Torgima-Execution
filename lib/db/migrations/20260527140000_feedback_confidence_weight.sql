-- Stores automated feedback confidence weight (user never sets this).
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS confidence_weight DOUBLE PRECISION;

UPDATE feedback
SET confidence_weight = CASE
  WHEN score IS NOT NULL AND score > 0 AND weighted_score IS NOT NULL
    THEN LEAST(1.0, GREATEST(0.3, weighted_score / score::float))
  ELSE 1.0
END
WHERE confidence_weight IS NULL;
