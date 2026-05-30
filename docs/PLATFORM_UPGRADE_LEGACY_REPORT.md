# Platform Upgrade — Legacy Systems Report

Migration: `platform_upgrade_v1_20260604`  
Date: 2026-06-04

## Canonical Path (New Source of Truth)

| Step | Route / Component | Purpose |
|------|-------------------|---------|
| 1 | `/validate` → `pre-validation.tsx` | Goal refinement |
| 2 | `/onboarding` → `ErectorOnboardingRefinementFlow` | Purpose + context + validation run |
| 3 | Context collection | Country, timeframe, commitment, domain (in refinement flow) |
| 4 | Validation running | Inline in `ErectorOnboardingRefinementFlow` |
| 5 | `/validation/:id/results` → `ValidationResultsDashboard` | Results + blueprint selection + launch |
| 6 | Blueprint selection | Starter / Growth / Ultimate (inline on results) |
| 7 | Blueprint launch | Finalize + launch on results page |
| 8 | `/dashboard` → `HomeDashboardView` | Execution system |

Upgrade gate: `/upgrade` for users with `execution_state = RESET_REQUIRED`.

---

## OLD SYSTEMS FOUND

| File | Route | Purpose | Used? | Replacement |
|------|-------|---------|-------|-------------|
| `pages/onboarding.tsx` (legacy ~900 lines) | `/onboarding` | Multi-step onboarding with aligned results + blueprint panel | **Retired** | Thin wrapper → `ErectorOnboardingRefinementFlow` |
| `components/validation/AlignedValidationResults.tsx` | (embedded in old onboarding) | Legacy validation results UI | **Unused** | `ValidationResultsDashboard` |
| `components/onboarding/OnboardingShell.tsx` | (embedded) | Legacy onboarding chrome | **Unused** | Refinement flow shell |
| `components/onboarding/OnboardingStructureStep.tsx` | (embedded) | Legacy structure step | **Unused** | Context step in refinement flow |
| `components/onboarding/ErectorIntakeFlow.tsx` | (embedded) | Old Erector intake | **Unused** | `ErectorOnboardingRefinementFlow` |
| `components/onboarding/AlignedGoalIntake.tsx` | (embedded) | Old goal intake | **Unused** | `pre-validation.tsx` |
| `pages/validation-scores.tsx` | `/validation/scores`, `/validation` | Legacy scores listing | **Redirect only** | `/validate` or `/validation/:id/results` |
| `pages/validation-running.tsx` | `/validation/:id/running` | Standalone running dashboard | **Redirect only** | `/validation/:id/results` |
| `pages/validation-blueprint.tsx` | `/validation/:id/blueprint` | Separate blueprint launch page | **Redirect only** | Inline launch on results page |
| `components/validation/ValidationScreen.tsx` | — | Legacy validation screen | **Unused** | `ValidationRunningDashboard` (in flow) |
| Split pre-validation steps | — | `PreValidationContextStep`, `PreValidationTimeframeStep`, etc. | **Partial** | Consolidated in `pre-validation.tsx` + refinement flow |

### Preserved (NOT removed)

Bhudhi, Signals, Conditions, Blueprint generation logic, Academy, Community, Messages, `/erector` dashboard, `/signals`, `/orders`, `/recovery`, all Bhudhi routes.

---

## Database Migration

| Artifact | Path |
|----------|------|
| Schema | `migrations/0033_platform_upgrade_reset.sql` |
| Data archive + user reset | `scripts/migrations/manual-20260604-platform-upgrade-migration.sql` |
| Rollback | `scripts/migrations/rollback-20260604-platform-upgrade-migration.sql` |

Archive table: `platform_upgrade_archive` — validations, blueprints, orders, plans, signal_snapshots, milestones.

User reset fields: `execution_state = RESET_REQUIRED`, `first_login_after_upgrade = true`, `onboarding_complete = false`, `active_blueprint_id = null`.

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/upgrade/status` | Check if upgrade screen required |
| GET | `/api/upgrade/archived` | List archived records summary |
| POST | `/api/upgrade/acknowledge` | Clear first-login flag |

Launch completion clears reset via `PlatformUpgradeService.completeUpgradeAfterLaunch`.

---

## Rollback Procedure

1. Stop traffic / enable maintenance mode.
2. Run `scripts/migrations/rollback-20260604-platform-upgrade-migration.sql`.
3. Restore user execution flags from `platform_upgrade_archive` payloads if full entity restore needed (manual per entity type).
4. Redeploy previous application version if frontend rollback required.
5. Verify users can access `/dashboard` with prior blueprints reactivated manually if restored.

Archived data is never hard-deleted by this migration.
