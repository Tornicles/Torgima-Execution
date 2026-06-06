/**
 * HTTP helpers for Erector E2E scenarios (in-process Express + session auth).
 */
import crypto from "node:crypto";
import type { Server } from "node:http";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";

export type JsonResponse = { res: Response; body: Record<string, unknown> };

export async function jsonFetch(url: string, init?: RequestInit): Promise<JsonResponse> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body };
}

export async function startErectorTestServer(): Promise<{ server: Server; baseUrl: string; close: () => Promise<void> }> {
  const { createApp } = await import("../../app.js");
  const app = await createApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

export async function createSessionForUser(userId: string): Promise<{
  headers: Record<string, string>;
  userId: string;
  token: string;
}> {
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const { pool } = await import("@workspace/db");
  await pool.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
    [userId, tokenHash],
  );
  return {
    userId,
    token,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function createSessionAuthHeaders(email?: string): Promise<{
  headers: Record<string, string>;
  userId: string;
  token: string;
}> {
  const testEmail = email ?? `erector_e2e_${Date.now()}@torgima.test`;
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  let userId = user?.id;
  if (!userId) {
    const { createTestUser } = await import("./db.js");
    const created = await createTestUser({ email: testEmail, display_name: "Erector E2E" });
    userId = created.id;
  }
  return createSessionForUser(userId);
}
