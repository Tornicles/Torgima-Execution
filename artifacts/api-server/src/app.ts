import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import webhooksRouter from "./routes/webhooks.js";
import { logger } from "./lib/logger.js";
import { bhudhiRateLimitMiddleware } from "./middleware/bhudhiRateLimit.js";
import { securityHeadersMiddleware } from "./middleware/securityHeaders.js";
import { apiRateLimitMiddleware } from "./middleware/apiRateLimit.js";

const app: Express = express();

app.disable("x-powered-by");

// CORS + GET /health are registered on the root app in index.ts before this mounts.

app.use(securityHeadersMiddleware);

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

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000 },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

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

export default app;
