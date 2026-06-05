/**
 * Express → Hono adapter for incremental route migration.
 * Handlers keep existing (req, res) signatures; only the HTTP shell changes.
 */

import type { Context } from "hono";

type ExpressLikeReq = {
  body: unknown;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  method: string;
  url: string;
  ip: string;
  cookies?: Record<string, string | undefined>;
  session?: { userId?: string };
};

type ExpressLikeRes = {
  status: (code: number) => ExpressLikeRes;
  json: (data: unknown) => void;
  redirect: (code: number, location: string) => void;
  cookie: (name: string, value: string, options?: { maxAge?: number; path?: string }) => void;
  clearCookie: (name: string, options?: { path?: string }) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

export function adaptExpressHandler(
  handler: (req: ExpressLikeReq, res: ExpressLikeRes) => Promise<void> | void,
) {
  return async (c: Context) => {
    const url = new URL(c.req.url);
    const req: ExpressLikeReq = {
      body: await c.req.json().catch(() => ({})),
      params: c.req.param() as Record<string, string>,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      method: c.req.method,
      url: url.pathname + url.search,
      ip: c.req.header("CF-Connecting-IP") ?? c.req.header("x-forwarded-for") ?? "unknown",
      cookies: parseCookieHeader(c.req.header("cookie")),
      session: { userId: c.get("userId") as string | undefined },
    };

    let statusCode = 200;
    let responseBody: unknown;
    let redirectUrl: string | null = null;
    const setCookies: string[] = [];

    const res: ExpressLikeRes = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: unknown) {
        responseBody = data;
      },
      redirect(code: number, location: string) {
        statusCode = code;
        redirectUrl = location;
      },
      cookie(name: string, value: string, options?: { maxAge?: number; path?: string }) {
        const maxAge = options?.maxAge ?? 86400;
        const path = options?.path ?? "/";
        setCookies.push(
          `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=${path}; Max-Age=${Math.floor(maxAge / 1000)}`,
        );
      },
      clearCookie(name: string, options?: { path?: string }) {
        const path = options?.path ?? "/";
        setCookies.push(`${name}=; HttpOnly; Secure; SameSite=Lax; Path=${path}; Max-Age=0`);
      },
      setHeader(name: string, value: string) {
        c.header(name, value);
      },
      end(body?: string) {
        responseBody = body ?? "";
      },
    };

    await handler(req, res);

    for (const cookie of setCookies) {
      c.header("Set-Cookie", cookie, { append: true });
    }

    if (redirectUrl) {
      return c.redirect(redirectUrl, statusCode as 301 | 302 | 303 | 307 | 308);
    }

    if (typeof responseBody === "string") {
      return new Response(responseBody, { status: statusCode });
    }

    return c.json(responseBody ?? null, statusCode as 200);
  };
}

function parseCookieHeader(header: string | undefined): Record<string, string | undefined> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=") || undefined];
    }),
  );
}
