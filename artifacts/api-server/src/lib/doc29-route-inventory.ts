/**
 * DOC29 — canonical API route inventory for deploy smoke and audit tests.
 */

export const DOC29_PUBLIC_ROUTES = [
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/auth/session",
  "GET /api/auth/verify",
  "POST /api/bhudhi/structure-goal",
] as const;

export const DOC29_INTELLIGENCE_READ_ROUTES = [
  "GET /api/state/current",
  "GET /api/state/dashboard",
  "GET /api/cognitive-load/current",
  "GET /api/rewards/current",
  "GET /api/rewards/history",
  "GET /api/outcomes/current",
  "POST /api/outcomes/:id/evidence",
  "GET /api/patterns/current",
  "GET /api/friction/current",
  "GET /api/failures/current",
  "GET /api/priority/current",
  "GET /api/dependencies/current",
  "GET /api/decisions/history",
  "GET /api/identity/history",
] as const;

export const DOC29_MUTATION_ROUTES = [
  "POST /api/onboarding/select-blueprint",
  "POST /api/blueprints/:id/activate",
  "POST /api/blueprints/select-tier",
  "PATCH /api/blueprints/:id",
  "POST /api/orders/:id/feedback",
  "POST /api/feedback/:id/clarify",
  "POST /api/uploads/proof",
  "POST /api/external/upload",
  "POST /api/external/link",
] as const;

export const DOC29_INTERNAL_ENGINE_ROUTES = [
  "POST /api/internal/feedback/process",
  "POST /api/internal/execution/guarantee",
  "POST /api/internal/inactivity/scan",
  "POST /api/internal/bhudhi/trigger",
  "POST /api/internal/rewards/evaluate",
  "POST /api/internal/outcomes/validate",
  "POST /api/internal/patterns/scan",
  "POST /api/internal/failures/classify",
  "POST /api/internal/friction/evaluate",
  "POST /api/internal/priority/evaluate",
  "POST /api/internal/dependencies/map",
  "POST /api/internal/identity/evaluate",
  "POST /api/internal/health/check",
  "POST /api/internal/orchestration/start",
  "GET /api/internal/dead-letter",
  "POST /api/internal/dead-letter/:id/resolve",
  "GET /api/internal/bhudhi/usage/summary",
] as const;

export const DOC29_KEY_API_ROUTES = [
  ...DOC29_PUBLIC_ROUTES,
  ...DOC29_INTELLIGENCE_READ_ROUTES,
  ...DOC29_MUTATION_ROUTES,
  ...DOC29_INTERNAL_ENGINE_ROUTES,
] as const;
