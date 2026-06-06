/** Workers bundle stub — real pino-http is Node-only via createApp(). */
import type { RequestHandler } from "express";

export default function pinoHttp(): RequestHandler {
  return (_req, _res, next) => next();
}
