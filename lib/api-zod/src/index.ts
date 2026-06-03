/** Zod schemas for API request/response validation (orval). */
export * from "./generated/api";

/**
 * OpenAPI TypeScript types — import via `@workspace/api-zod/types`.
 * Not re-exported from the package root: several names collide with Zod schema consts
 * (e.g. SendMagicLinkBody, PostValidationCompleteBody).
 */
