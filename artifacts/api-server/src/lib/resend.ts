import { Resend } from "resend";
import { logger } from "./logger.js";

// Resend singleton — the only place a Resend client may be instantiated.
// Spec: Prompt 1 §lib/resend.

const globalForResend = globalThis as unknown as {
  resend: Resend | undefined;
};

function createResendClient(): Resend {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — outbound emails will be skipped");
  }
  return new Resend(apiKey ?? "placeholder");
}

export const resend: Resend = globalForResend.resend ?? createResendClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForResend.resend = resend;
}

export const EMAIL_FROM: string =
  process.env["EMAIL_FROM"] ?? "noreply@torgima.com";

export const EMAIL_REPLY_TO: string =
  process.env["EMAIL_REPLY_TO"] ?? "support@torgima.com";

export interface OutboundEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /** Full RFC5322 From, e.g. "Torgima <noreply@domain.com>" */
  from?: string;
}

// Best-effort send. Returns { sent: false } when no key is configured or
// the provider call fails — never throws, so callers (e.g. AuthService)
// can decide what to do with a missing email channel without poisoning the
// surrounding transaction. Logs every outcome.
export async function sendEmail(
  msg: OutboundEmail,
): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (!process.env["RESEND_API_KEY"]) {
    logger.info(
      { to: msg.to, subject: msg.subject },
      "[resend] RESEND_API_KEY not set — email skipped",
    );
    return { sent: false, error: "RESEND_API_KEY not set" };
  }

  try {
    const textBody =
      msg.text?.trim() ||
      (msg.html
        ? msg.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        : "") ||
      "(See HTML version of this message.)";

    const result = await resend.emails.send({
      from: msg.from ?? EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      ...(msg.html ? { html: msg.html } : {}),
      text: textBody,
      replyTo: msg.replyTo ?? EMAIL_REPLY_TO,
    });

    if (result.error) {
      const errorMsg = String(result.error);
      logger.error({ to: msg.to, error: errorMsg }, "[resend] Send failed");
      return { sent: false, error: errorMsg };
    }

    return { sent: true, id: result.data?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ to: msg.to, error: errorMsg }, "[resend] Send threw");
    return { sent: false, error: errorMsg };
  }
}
