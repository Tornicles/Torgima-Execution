import type { SharedContextRecord } from "../contracts/types.js";
import {
  getOrCreateSharedContext,
  updateSharedContext,
  updateSharedSubsystem,
} from "../kernelData.js";

export class SharedContextService {
  async getContext(blueprintId: string): Promise<SharedContextRecord> {
    return getOrCreateSharedContext(blueprintId);
  }

  async updateContext(
    blueprintId: string,
    updates: Parameters<typeof updateSharedContext>[1],
    engine: string,
  ): Promise<SharedContextRecord> {
    return updateSharedContext(blueprintId, updates, engine);
  }

  async updateSubsystem(
    blueprintId: string,
    subsystem: Parameters<typeof updateSharedSubsystem>[1],
    data: Record<string, unknown>,
    engine: string,
  ): Promise<SharedContextRecord> {
    return updateSharedSubsystem(blueprintId, subsystem, data, engine);
  }

  async getField<K extends keyof SharedContextRecord>(
    blueprintId: string,
    field: K,
  ): Promise<SharedContextRecord[K]> {
    const ctx = await getOrCreateSharedContext(blueprintId);
    return ctx[field];
  }

  async validateContext(blueprintId: string): Promise<{ valid: boolean; issues: string[] }> {
    const context = await getOrCreateSharedContext(blueprintId);
    const issues: string[] = [];

    if (context.signal === "nothingness" && context.domain !== "genesis") {
      issues.push("Nothingness signal should only occur in genesis domain");
    }

    const execution = context.execution as { steps?: unknown[] };
    if (context.phase === "execution" && !execution?.steps) {
      issues.push("Execution context missing steps for executing phase");
    }

    return { valid: issues.length === 0, issues };
  }
}

export const sharedContextService = new SharedContextService();
