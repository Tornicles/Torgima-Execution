import { randomUUID } from "crypto";
import { type Request, type Response } from "express";
import { TorgimaError, torgimaErrorToStatus, isTorgimaError } from "./errors.js";
import { logger } from "./logger.js";

export function generateId(): string {
  return randomUUID();
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    retryable?: boolean;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

export function success<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = {
    ok: true,
    data,
    meta: { timestamp: new Date().toISOString() },
  };
  res.status(status).json(body);
}

export function failure(
  res: Response,
  code: string,
  message: string,
  status = 500,
  opts?: { fieldErrors?: Record<string, string[]>; retryable?: boolean },
): void {
  const body: ApiResponse = {
    ok: false,
    error: { code, message, ...opts },
    meta: { timestamp: new Date().toISOString() },
  };
  res.status(status).json(body);
}

export function handleError(req: Request, res: Response, err: unknown): void {
  if (isTorgimaError(err)) {
    const status = torgimaErrorToStatus(err.code);
    failure(res, err.code, err.message, status, {
      fieldErrors: err.fieldErrors,
      retryable: err.retryable,
    });
    return;
  }

  req.log.error({ err }, "Unhandled error in route handler");
  failure(res, "INTERNAL_ERROR", "An unexpected error occurred", 500);
}

export function requireParam(
  params: Record<string, string | undefined>,
  name: string,
): string {
  const val = params[name];
  if (!val) throw new TorgimaError("VALIDATION_ERROR", `Missing param: ${name}`);
  return val;
}

export function now(): string {
  return new Date().toISOString();
}
