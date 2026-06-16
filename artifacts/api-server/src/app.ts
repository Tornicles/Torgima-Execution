import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import webhooksRouter from "./routes/webhooks.js";
import externalRouter from "./routes/external.js";
import { logger } from "./lib/logger.js";
import { isCloudflareRuntime } from "./lib/cloudflare-runtime.js";
import { bhudhiRateLimitMiddleware } from "./middleware/bhudhiRateLimit.js";
import { securityHeadersMiddleware } from "./middleware/securityHeaders.js";
import { apiRateLimitMiddleware } from "./middleware/apiRateLimit.js";
import { applyCorsHeaders } from "./lib/cors.js";
import { handleError } from "./lib/utils.js";

/** Requests slower than this are flagged for egress/perf review (metadata only). */
const SLOW_REQUEST_MS = 3_000;

async function attachRequestLogging(app: Express): Promise<void> {
  if (isCloudflareRuntime()) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => {
        const path = req.url?.split("?")[0] ?? req.path;
        if (path === "/health" || path === "/healthz") return;
        const durationMs = Date.now() - started;
        logger.info(
          {
            type: "request",
            requestId: res.locals.requestId,
            method: req.method,
            url: path,
            status: res.statusCode,
            durationMs,
            ip: req.headers["cf-connecting-ip"] ?? req.ip,
            country: req.headers["cf-ipcountry"],
          },
          "request",
        );
        // Egress/perf signal: flag slow handlers (likely many DB round-trips).
        // Metadata only — never logs request/response payloads.
        if (durationMs > SLOW_REQUEST_MS) {
          logger.warn(
            {
              type: "slow_request",
              requestId: res.locals.requestId,
              method: req.method,
              url: path,
              status: res.statusCode,
              durationMs,
            },
            "slow_request",
          );
        }
      });
      next();
    });
    return;
  }

  const { default: pinoHttp } = await import("pino-http");
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
}

/** Build Express API app. Dynamic import of pino-http avoids bundling it on Workers. */
export async function createApp(): Promise<Express> {
  const app: Express = express();

  app.disable("x-powered-by");

  app.use(securityHeadersMiddleware);
  await attachRequestLogging(app);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: { maxAge: 31536000 },
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  app.use(cookieParser());

  app.use(
    "/api/webhooks",
    express.raw({
      type: ["application/json", "application/json; charset=utf-8"],
      limit: "2mb",
    }),
    webhooksRouter,
  );

  app.use(
    "/api/external",
    express.json({ limit: "11mb" }),
    externalRouter,
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.use("/api", apiRateLimitMiddleware);
  app.use("/api", bhudhiRateLimitMiddleware);

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", router);

  // Global error handler — 4-argument signature required by Express.
  // Must be registered AFTER all routes.
  // Re-applies CORS headers in case an error bypassed the root-level CORS middleware
  // (e.g. errors thrown synchronously before the middleware response phase completes).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, req: Request, res: Response, _next: NextFunction): void => {
    // Ensure CORS headers are present on every error response.
    // applyCorsHeaders is a no-op when the origin is not in the allowed list.
    applyCorsHeaders(req, res);
    handleError(req, res, err);
  });

  return app;
}
