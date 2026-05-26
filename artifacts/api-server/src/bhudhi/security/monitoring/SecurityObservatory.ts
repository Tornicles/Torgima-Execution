import type { SecurityInput } from "../contracts/types.js";

export type RetentionWindow = "30d" | "90d" | "1y" | "sealed";

export class SecurityObservatory {
  snapshot(input: SecurityInput, eventCount: number): Record<string, unknown> {
    return {
      events: eventCount,
      permissions: input.requestedPermission ?? "execute",
      actorId: input.actorId ?? "anonymous",
      capabilities: (input.capabilities ?? []).length,
      retention: "30d" as RetentionWindow,
    };
  }

  retentionWindows(): RetentionWindow[] {
    return ["30d", "90d", "1y", "sealed"];
  }
}

export const securityObservatory = new SecurityObservatory();
