/**
 * Launch Mode helpers — centralised reads of production feature-gate env flags.
 *
 * All functions read process.env at call time so they pick up the values bound
 * by bindCloudflareEnv() on each Worker request.  Never cache at module scope.
 *
 * Default (when the flag is absent): the safe/conservative value — i.e.
 * advanced features are OFF unless explicitly enabled.
 */

function boolEnv(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * LAUNCH_MODE=true → MVP-safe lazy initialization.
 *
 * When enabled:
 *  - signup and login create/sync only the auth + public.users profile
 *  - JWT passthrough when profile DB lookup fails (see auth.ts)
 *  - /api/upgrade/status returns starter defaults without hitting upgrade tables
 *  - all heavy cron and background jobs are skipped
 *  - validation, launch, and dashboard use System Resilience Layer fallbacks
 *  - missing optional data must never block login/dashboard rendering
 *
 * Set to "false" once the platform is stable and all advanced features are ready.
 * Default: false (conservative — advanced features enabled unless explicitly gated).
 */
export function isLaunchMode(): boolean {
  return boolEnv("LAUNCH_MODE");
}

/**
 * ENABLE_ADVANCED_UPGRADE_GATE=true → run archive + migration DB queries
 * in /api/upgrade/status and enforce RESET_REQUIRED redirects.
 * Default: false → always return starter-safe defaults.
 */
export function isAdvancedUpgradeGateEnabled(): boolean {
  return boolEnv("ENABLE_ADVANCED_UPGRADE_GATE");
}

/**
 * ENABLE_BACKGROUND_BHUDHI=true → allow background Bhudhi civilization /
 * identity systems to bootstrap automatically.
 * Default: false → Bhudhi activates only when the user explicitly opens a Bhudhi page.
 */
export function isBackgroundBhudhiEnabled(): boolean {
  return boolEnv("ENABLE_BACKGROUND_BHUDHI");
}

/**
 * ENABLE_TEAM_BOOTSTRAP=true → automatically create team records on signup.
 * Default: false → teams are created lazily when the user visits the team section.
 */
export function isTeamBootstrapEnabled(): boolean {
  return boolEnv("ENABLE_TEAM_BOOTSTRAP");
}

/**
 * ENABLE_SIGNAL_AUTO_BOOTSTRAP=true → auto-bootstrap the signal engine on
 * blueprint launch.
 * Default: false → signals load lazily when the user visits the Signals page.
 */
export function isSignalAutoBootstrapEnabled(): boolean {
  return boolEnv("ENABLE_SIGNAL_AUTO_BOOTSTRAP");
}

/**
 * ENABLE_MAGIC_LINK_AUTH=true → enable the legacy magic-link email flow.
 * Default: false → Supabase email/password is the only active auth method.
 */
export function isMagicLinkAuthEnabled(): boolean {
  return boolEnv("ENABLE_MAGIC_LINK_AUTH");
}

/** Core execution-loop event types that must drain even when LAUNCH_MODE=true. */
export const CORE_EXECUTION_EVENT_TYPES = new Set([
  "feedback_submitted",
  "feedback_submitted_partial",
  "interrogation_answered",
  "signal_recalculation_requested",
  "signal_calculated",
  "condition_evaluation_requested",
  "condition_evaluated",
  "enforcement_package_created",
  "task_generation_requested",
  "task_generation_completed",
  "task_generation_failed",
  "order_available",
  "erector_blueprint_launched",
]);

/**
 * Non-critical crons skipped in launch mode. Event dispatch poll is always allowed.
 */
export function isNonCriticalCronInLaunchMode(cronExpression: string): boolean {
  const nonCritical = new Set([
    "0 2 * * *", // session cleanup
    "*/30 * * * *", // inactivity
    "0 3 * * *", // pattern daily
    "*/10 * * * *", // state integrity
  ]);
  return nonCritical.has(cronExpression);
}
