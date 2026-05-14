import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import webhooksRouter from "./routes/webhooks.js";
import { logger } from "./lib/logger.js";

const defaultFrontendOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const corsOrigins = (process.env.FRONTEND_URL ?? defaultFrontendOrigins.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOriginOption: CorsOptions["origin"] =
  corsOrigins.length <= 1
    ? corsOrigins[0] ?? defaultFrontendOrigins[0]
    : corsOrigins;

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
    origin: corsOriginOption,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-internal-auth",
      "idempotency-key",
      "x-expected-state-version",
      "Cookie",
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
