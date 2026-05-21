// Feature flags — runtime gates for capabilities that ship in different
// phases. Phase 1 flags listed first; later-phase flags are present so
// `checkFeatureFlag` can short-circuit them deterministically.
//
// Spec: Prompt 1 §constants/feature-flags. Mirrors the 14 rows seeded by
// `lib/db/src/seed.ts`.

export const FEATURE_FLAGS = {
  AI_ENABLED:                  "ai_enabled",
  ACADEMY_ENABLED:             "academy_enabled",
  IDENTITY_SYSTEM_ENABLED:     "identity_system_enabled",
  COMPULSION_LOOP_ENABLED:     "compulsion_loop_enabled",
  OUTCOME_VALIDATION_ENABLED:  "outcome_validation_enabled",
  TEAM_MODE_ENABLED:           "team_mode_enabled",
  COMMUNITY_ENABLED:           "community_enabled",
  ADVANCED_DOMAINS_ENABLED:    "advanced_domains_enabled",
  ADVANCED_FRAMEWORKS_ENABLED: "advanced_frameworks_enabled",
  AI_ADVANCED_ENABLED:         "ai_advanced_enabled",
  MARKETPLACE_ENABLED:         "marketplace_enabled",
  CONTENT_ENGINE_ENABLED:      "content_engine_enabled",
  PREDICTIVE_SIGNALS_ENABLED:  "predictive_signals_enabled",
  EXTERNAL_INTEGRATIONS_ENABLED: "external_integrations_enabled",
  PRINCIPLES_365_ENABLED:         "principles_365_enabled",
  CALENDAR_ENABLED:               "calendar_enabled",
  CHAT_ENABLED:                   "chat_enabled",
  NOTIFICATIONS_MULTI_CHANNEL_ENABLED: "notifications_multi_channel_enabled",
  GAMIFICATION_ENABLED:               "gamification_enabled",
  MOBILE_APP_ENABLED:                 "mobile_app_enabled",
  ANALYTICS_ENABLED:                  "analytics_enabled",
  PUBLIC_PROFILES_ENABLED:            "public_profiles_enabled",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

const PHASE1_DEFAULT_ON: readonly FeatureFlagKey[] = [
  FEATURE_FLAGS.AI_ENABLED,
  FEATURE_FLAGS.ACADEMY_ENABLED,
  FEATURE_FLAGS.IDENTITY_SYSTEM_ENABLED,
  FEATURE_FLAGS.COMPULSION_LOOP_ENABLED,
  FEATURE_FLAGS.OUTCOME_VALIDATION_ENABLED,
  FEATURE_FLAGS.PRINCIPLES_365_ENABLED,
  FEATURE_FLAGS.CALENDAR_ENABLED,
  FEATURE_FLAGS.CHAT_ENABLED,
  FEATURE_FLAGS.NOTIFICATIONS_MULTI_CHANNEL_ENABLED,
  FEATURE_FLAGS.GAMIFICATION_ENABLED,
  FEATURE_FLAGS.MOBILE_APP_ENABLED,
  FEATURE_FLAGS.ANALYTICS_ENABLED,
  FEATURE_FLAGS.EXTERNAL_INTEGRATIONS_ENABLED,
  FEATURE_FLAGS.PUBLIC_PROFILES_ENABLED,
];

// Static pre-DB-lookup default. Real runtime checks should call
// `checkFeatureFlag` (lib/utils.ts) which reads the `feature_flags` table.
export function isFeatureEnabledByDefault(flag: FeatureFlagKey): boolean {
  return PHASE1_DEFAULT_ON.includes(flag);
}
