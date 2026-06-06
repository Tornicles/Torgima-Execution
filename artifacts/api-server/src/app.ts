import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import webhooksRouter from "./routes/webhooks.js";
import { logger } from "./lib/logger.js";
import { isCloudflareRuntime } from "./lib/cloudflare-runtime.js";
import { bhudhiRateLimitMiddleware } from "./middleware/bhudhiRateLimit.js";
import { securityHeadersMiddleware } from "./middleware/securityHeaders.js";
import { apiRateLimitMiddleware } from "./middleware/apiRateLimit.js";

async function attachRequestLogging(app: Express): Promise<void> {
  if (isCloudflareRuntime()) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => {
        const path = req.url?.split("?")[0] ?? req.path;
        if (path === "/health" || path === "/healthz") return;
        logger.info(
          {
            type: "request",
            requestId: res.locals.requestId,
            method: req.method,
            url: path,
            status: res.statusCode,
            durationMs: Date.now() - started,
            ip: req.headers["cf-connecting-ip"] ?? req.ip,
            country: req.headers["cf-ipcountry"],
          },
          "request",
        );
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

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.use("/api", apiRateLimitMiddleware);
  app.use("/api", bhudhiRateLimitMiddleware);

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", router);

  return app;
}
