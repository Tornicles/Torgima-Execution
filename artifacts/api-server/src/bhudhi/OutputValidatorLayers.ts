import type { BhudhiOutputType } from "../types/bhudhi.js";
import { validateOutput } from "./OutputValidator.js";
import { validateWorldStateVersion } from "../engines/world-model/WorldModelEngine.js";

export const FORBIDDEN_ACTIONS = [
  "override_signal",
  "set_condition",
  "approve_blueprint",
  "complete_phase",
  "grant_permission",
  "write_signal_value",
  "bypass_control_engine",
] as const;

export interface LayerValidationResult {
  passed: boolean;
  failLayer?: string;
  failReason?: string;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  repairedOutput?: unknown;
}

function detectForbiddenInPayload(raw: unknown): string | null {
  const text = JSON.stringify(raw).toLowerCase();
  for (const action of FORBIDDEN_ACTIONS) {
    if (text.includes(action)) return action;
  }
  if (text.includes('"setcondition"') || text.includes("assign condition")) return "set_condition";
  if (text.includes("write_signal") || text.includes("signal value")) return "write_signal_value";
  return null;
}

function detectAuthorityClaim(raw: unknown): boolean {
  const text = JSON.stringify(raw).toLowerCase();
  return (
    text.includes("i have approved") ||
    text.includes("condition is now") ||
    text.includes("signal has been set") ||
    text.includes("blueprint is activated")
  );
}

export async function validateOutputLayers(params: {
  raw: unknown;
  expectedType: BhudhiOutputType;
  expectedStateVersion: number;
  userId: string;
  promptContract: string;
}): Promise<LayerValidationResult> {
  if (typeof params.raw === "string") {
    try {
      params.raw = JSON.parse(params.raw) as unknown;
    } catch {
      return {
        passed: false,
        failLayer: "json_parse",
        failReason: "Invalid JSON",
        confidenceTier: "LOW",
      };
    }
  }

  const envelope = params.raw as Record<string, unknown>;
  const confidence = (envelope["confidence"] as string) ?? "MEDIUM";
  const confidenceTier: LayerValidationResult["confidenceTier"] =
    confidence === "HIGH" || confidence === "LOW" ? confidence : "MEDIUM";

  const forbidden = detectForbiddenInPayload(params.raw);
  if (forbidden || envelope["forbiddenActionRequested"] === true) {
    return {
      passed: false,
      failLayer: "forbidden_action",
      failReason: `Forbidden action: ${forbidden ?? "forbiddenActionRequested"}`,
      confidenceTier,
    };
  }

  const schema = validateOutput(params.raw, params.expectedType, params.expectedStateVersion);
  if (!schema.ok) {
    return {
      passed: false,
      failLayer: "schema",
      failReason: schema.errors.join("; "),
      confidenceTier,
    };
  }

  const versionOk = await validateWorldStateVersion(params.userId, params.expectedStateVersion);
  if (!versionOk) {
    return {
      passed: false,
      failLayer: "world_state_version",
      failReason: "Stale world state version",
      confidenceTier,
    };
  }

  if (detectAuthorityClaim(params.raw)) {
    return {
      passed: false,
      failLayer: "authority_claim",
      failReason: "Output claims system authority",
      confidenceTier,
    };
  }

  return { passed: true, confidenceTier };
}
