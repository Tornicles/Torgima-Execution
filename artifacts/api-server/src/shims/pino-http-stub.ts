/** Workers bundle stub — real pino-http is Node-only via createApp(). */
import type { RequestHandler } from "express";
import { logger } from "../lib/logger.js";

export default function pinoHttp(): RequestHandler {
  return (req, _res, next) => {
    req.log = logger.child({ req: { method: req.method, url: req.url } });
    next();
  };
}
