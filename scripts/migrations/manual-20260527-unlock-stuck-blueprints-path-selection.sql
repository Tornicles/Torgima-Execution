-- Emergency unlock: blueprints that finished validation but never reached path_selection
UPDATE blueprints
SET
  status = 'path_selection',
  selected_path = COALESCE(selected_path, 'adjusted'),
  -- Normalize to user_tier when available; safe for text columns too.
  selected_blueprint_level = COALESCE(
    selected_blueprint_level,
    tier::user_tier,
    'starter'::user_tier
  )
WHERE status IN ('draft', 'validating', 'awaiting_selection')
  AND validation_verdict IS NOT NULL
  AND active = false;

-- Confirm rows ready for launch
SELECT id, status, selected_path, validation_verdict, validation_id
FROM blueprints
WHERE status = 'path_selection'
ORDER BY created_at DESC
LIMIT 20;
