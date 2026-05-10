import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import webhooksRouter from "./routes/webhooks.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

/** Comma-separated list for multiple preview URLs; omit in local dev for permissive origin. */
const FRONTEND_URL = process.env["FRONTEND_URL"] ?? "";
const corsOrigin =
  FRONTEND_URL.trim() !== ""
    ? FRONTEND_URL.split(",").map((o) => o.trim()).filter(Boolean)
    : true;

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
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-internal-auth",
      "idempotency-key",
      "x-expected-state-version",
    ],
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
