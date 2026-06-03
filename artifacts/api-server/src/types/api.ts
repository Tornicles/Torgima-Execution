export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    retryable?: boolean;
    sessionExpired?: boolean;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}
