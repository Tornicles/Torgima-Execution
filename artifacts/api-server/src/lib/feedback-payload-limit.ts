import type { Request } from "express";
import { TorgimaError } from "./errors.js";

/** DOC 37 — reject oversized feedback before engine (10 KB raw JSON). */
export const FEEDBACK_PAYLOAD_MAX_BYTES = 10 * 1024;

export function assertFeedbackPayloadWithinLimit(req: Request): void {
  const lenHeader = req.headers["content-length"];
  if (lenHeader) {
    const n = Number(lenHeader);
    if (Number.isFinite(n) && n > FEEDBACK_PAYLOAD_MAX_BYTES) {
      throw new TorgimaError(
        "PAYLOAD_TOO_LARGE",
        "Feedback payload exceeds maximum size",
        false,
      );
    }
  }
  const body = req.body;
  if (body && typeof body === "object") {
    const size = Buffer.byteLength(JSON.stringify(body), "utf8");
    if (size > FEEDBACK_PAYLOAD_MAX_BYTES) {
      throw new TorgimaError(
        "PAYLOAD_TOO_LARGE",
        "Feedback payload exceeds maximum size",
        false,
      );
    }
  }
}
