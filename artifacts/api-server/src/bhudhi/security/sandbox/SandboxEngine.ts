import type { SandboxMode, SecurityInput, SecurityDecision } from "../contracts/types.js";

export class SandboxEngine {
  evaluate(input: SecurityInput): { mode: SandboxMode; required: boolean; decision: SecurityDecision } {
    const unknown = input.execution?.unknownOrigin === true;
    const plugin = input.execution?.plugin === true;
    const agent = input.execution?.agentIsolated !== true && input.execution?.type === "agent";

    if (unknown || plugin) {
      return { mode: "STRICT", required: true, decision: "sandbox" };
    }
    if (agent) {
      return { mode: "STANDARD", required: true, decision: "sandbox" };
    }
    if (input.execution?.airlock === true) {
      return { mode: "AIRLOCK", required: true, decision: "sandbox" };
    }

    return { mode: "OPEN", required: false, decision: "allow" };
  }

  isolates(): string[] {
    return ["agents", "simulations", "plugins", "memory", "execution"];
  }
}

export const sandboxEngine = new SandboxEngine();
