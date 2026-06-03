/** DOC 31 — standard API envelope (matches backend ApiResponse). */

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    retryable?: boolean;
    sessionExpired?: boolean;
    detail?: string;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
    stateVersion?: number;
    projectionVersion?: number;
  };
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  expectedStateVersion?: number;
  signal?: AbortSignal;
}
