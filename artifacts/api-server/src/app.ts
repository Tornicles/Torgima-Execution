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

const DEV_ORIGINS =
  process.env.NODE_ENV === "production"
    ? []
    : [`http://localhost:${process.env.FRONTEND_DEV_PORT ?? "5173"}`, `http://localhost:${process.env.APP_DEV_PORT ?? "3000"}`];

const ALLOWED_ORIGINS = [
  ...explicitOrigins,
  "https://torgima-execution.vercel.app",
  "https://torgima.com",
  ...DEV_ORIGINS,
];

const app: Express = express();

const corsOptions: cors.CorsOptions = {
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
};

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

app.use(cors(corsOptions));

// Ensure preflight requests always receive the same CORS configuration.
// Express route patterns differ across versions; "*" is the most reliable.
app.options("*", cors(corsOptions));

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
