/**
 * DOC 31 — typed API client entry (canonical import path).
 * Implementation lives in `src/api/client.ts`.
 */

export {
  apiRequest,
  generateIdempotencyKey,
  redirectToLogin,
} from "@/api/client";

export type { ApiResponse, ApiRequestOptions } from "@/api/types";
