-- Backfill tier and intelligence_depth for blueprints awaiting or active launch
UPDATE blueprints
SET
  tier = COALESCE(tier, 'growth'::user_tier),
  intelligence_depth = COALESCE(intelligence_depth, 'operational'::intelligence_depth),
  selected_blueprint_level = COALESCE(selected_blueprint_level, 'growth'),
  blueprint_tier = COALESCE(blueprint_tier, 'growth')
WHERE tier IS NULL
  AND status IN ('active', 'path_selection', 'awaiting_selection');
