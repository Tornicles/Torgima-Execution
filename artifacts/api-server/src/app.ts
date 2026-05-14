import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import webhooksRouter from "./routes/webhooks.js";
import { logger } from "./lib/logger.js";

const defaultFrontendOrigins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"];

const ALLOWED_ORIGINS = [
  ...defaultFrontendOrigins,
  ...(process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  "https://torgima-execution.vercel.app",
  "https://torgima-execution-git-main-tornicles-projects.vercel.app",
];

function corsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (corsOriginAllowed(origin ?? undefined)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, "[cors] blocked origin");
      callback(null, false);
    }
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
app.use(cors(corsOptions));
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
