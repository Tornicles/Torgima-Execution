import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import webhooksRouter from "./routes/webhooks.js";
import { logger } from "./lib/logger.js";

const rawFrontend = process.env.FRONTEND_URL ?? "";
const explicitOrigins = rawFrontend
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = [
  ...explicitOrigins,
  "https://torgima-execution.vercel.app",
  "https://torgima.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

const app: Express = express();

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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      if (origin.includes("localhost")) return callback(null, true);
      if (origin.startsWith("http://127.0.0.1:")) return callback(null, true);
      console.warn("[CORS] Blocked origin:", origin);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-internal-auth",
      "x-expected-state-version",
      "idempotency-key",
      "Cookie",
    ],
    exposedHeaders: ["Set-Cookie"],
  }),
);

app.options("/{*splat}", cors());

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cookieParser());

app.use(
  "/api/webhooks",
  express.raw({
    type: ["application/json", "application/json; charset=utf-8"],
    limit: "2mb",
  }),
  webhooksRouter,
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRouter);
app.use("/api", router);

export default app;
