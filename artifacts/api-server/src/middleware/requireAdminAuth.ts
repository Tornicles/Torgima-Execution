import type { Request, Response, NextFunction } from "express";
import { validateAdminSession, ADMIN_SESSION_COOKIE } from "../services/AdminAuthService.js";
import { failure } from "../lib/utils.js";

export type AdminRequest = Request & { admin?: { email: string; sessionId: string } };

export async function requireAdminAuth(
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId = req.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
  const session = await validateAdminSession(sessionId);
  if (!session) {
    failure(res, "FORBIDDEN", "Admin authentication required", 403);
    return;
  }
  req.admin = session;
  next();
}
