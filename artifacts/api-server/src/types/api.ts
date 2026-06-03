export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    class?: string;
    detail?: string;
    fieldErrors?: Record<string, string[]>;
    retryable?: boolean;
    sessionExpired?: boolean;
  };
  stateChanged?: boolean;
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}
