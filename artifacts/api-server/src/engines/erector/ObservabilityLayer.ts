import { db, erectorObservabilityLogs } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { sanitizeLogPayload } from "../../services/erector/PrivacySecurityLayer.js";

export class ObservabilityLayer {
  static async logRun(input: {
    run_type: string;
    run_id: string;
    userId?: string;
    blueprintId?: string;
    latency_ms: number;
    verdict_issued?: string;
    user_accepted_verdict?: boolean;
    bhudhi_called?: boolean;
    bhudhi_fallback_used?: boolean;
    bhudhi_tokens_used?: number;
    result_summary?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await db.insert(erectorObservabilityLogs).values({
        run_type: input.run_type,
        run_id: input.run_id,
        user_id: input.userId ?? null,
        blueprint_id: input.blueprintId ?? null,
        latency_ms: input.latency_ms,
        verdict_issued: input.verdict_issued ?? null,
        user_accepted_verdict: input.user_accepted_verdict ?? null,
        bhudhi_called: input.bhudhi_called ?? false,
        bhudhi_fallback_used: input.bhudhi_fallback_used ?? false,
        bhudhi_tokens_used: input.bhudhi_tokens_used ?? null,
        result_summary: sanitizeLogPayload(input.result_summary ?? {}),
      });
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), run_type: input.run_type },
        "[ObservabilityLayer] Failed to write log",
      );
    }
  }

  static async logApiCall(
    route: string,
    userId: string,
    latencyMs: number,
    statusCode: number,
    blueprintId?: string | null,
  ): Promise<void> {
    await ObservabilityLayer.logRun({
      run_type: "erector_api",
      run_id: route,
      userId,
      blueprintId: blueprintId ?? undefined,
      latency_ms: latencyMs,
      result_summary: { status_code: statusCode, route },
    });
  }
}
