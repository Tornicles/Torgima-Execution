import { logger } from "../logger.js";

const SUSPICIOUS_PATTERNS = [
  /ignore.{0,20}previous.{0,20}instruction/i,
  /system.{0,10}prompt/i,
  /\byou are now\b/i,
  /\bdisregard\b/i,
  /\boverride\b/i,
  /\bjailbreak\b/i,
  /\bDAN\b/,
  /api.{0,10}key/i,
];

export function sanitizeBhudhiInput(rawInput: string | undefined | null): string {
  if (!rawInput) return "";

  let cleaned = rawInput.replace(/<[^>]*>/g, "");
  cleaned = cleaned.replace(/\[INST\][\s\S]*?\[\/INST\]/gi, "");
  cleaned = cleaned.replace(/<<SYS>>[\s\S]*?<<\/SYS>>/gi, "");
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  cleaned = cleaned.substring(0, 2000);

  if (SUSPICIOUS_PATTERNS.some((p) => p.test(rawInput))) {
    logger.warn(
      { preview: rawInput.substring(0, 100) },
      "[SECURITY] Suspicious prompt injection attempt detected",
    );
  }

  return cleaned;
}
