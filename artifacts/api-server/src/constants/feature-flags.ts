export const FEATURE_FLAGS = {
  AI_ENABLED: "ai_enabled",
  ACADEMY_ENABLED: "academy_enabled",
  IDENTITY_SYSTEM_ENABLED: "identity_system_enabled",
  COMPULSION_LOOP_ENABLED: "compulsion_loop_enabled",
  OUTCOME_VALIDATION_ENABLED: "outcome_validation_enabled",
  TEAM_MODE_ENABLED: "team_mode_enabled",
  COMMUNITY_ENABLED: "community_enabled",
  ADVANCED_DOMAINS_ENABLED: "advanced_domains_enabled",
  ADVANCED_FRAMEWORKS_ENABLED: "advanced_frameworks_enabled",
  AI_ADVANCED_ENABLED: "ai_advanced_enabled",
  MARKETPLACE_ENABLED: "marketplace_enabled",
} as const;

export type FeatureFlagKey =
  (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  const phase1Flags: FeatureFlagKey[] = [
    FEATURE_FLAGS.AI_ENABLED,
    FEATURE_FLAGS.ACADEMY_ENABLED,
    FEATURE_FLAGS.IDENTITY_SYSTEM_ENABLED,
    FEATURE_FLAGS.COMPULSION_LOOP_ENABLED,
    FEATURE_FLAGS.OUTCOME_VALIDATION_ENABLED,
  ];
  return phase1Flags.includes(flag);
}
