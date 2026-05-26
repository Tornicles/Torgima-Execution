import { randomUUID } from "node:crypto";
import { securityPolicy } from "../policy/SecurityPolicy.js";
import { identityVerifier } from "../identity/IdentityVerifier.js";
import { trustEngine } from "../trust/TrustEngine.js";
import { authorizationEngine } from "../authorization/AuthorizationEngine.js";
import { capabilityGuard } from "../capabilities/CapabilityGuard.js";
import { sandboxEngine } from "../sandbox/SandboxEngine.js";
import { secretEngine } from "../secrets/SecretEngine.js";
import { threatEngine } from "../monitoring/ThreatEngine.js";
import { securityObservatory } from "../monitoring/SecurityObservatory.js";
import { securityResponse } from "../response/SecurityResponse.js";
import { securityMemory } from "../security-memory/SecurityMemory.js";
import {
  persistSecurityVerify,
  persistTrustProfile,
  persistThreat,
  persistPermission,
  listSecurityHistory,
} from "../securityData.js";
import type {
  ResponseAction,
  SecurityDecision,
  SecurityInput,
  SecurityOutput,
  SecurityPermission,
  ThreatResult,
} from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BSE — trust continuously verified. Default deny.
 */
export class SecurityEngine {
  async verify(input: SecurityInput): Promise<SecurityOutput> {
    return this.runCycle(input);
  }

  async trust(input: SecurityInput) {
    const policy = securityPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Security policy violation: ${policy.violations.join("; ")}`);
    }
    const trust = trustEngine.score(input);
    const subject = identityVerifier.identify(input);
    try {
      await persistTrustProfile(input.blueprintId, subject.subjectId, trust);
    } catch (err) {
      logger.warn({ err }, "[SecurityEngine] trust persist skipped");
    }
    return trust;
  }

  async authorize(input: SecurityInput, permission: SecurityPermission = "execute") {
    const full = await this.runCycle({ ...input, requestedPermission: permission });
    return full.authorization ?? { allowed: false, constraints: ["default_deny"], approvals: [] };
  }

  async threat(input: SecurityInput): Promise<ThreatResult[]> {
    return threatEngine.detect(input);
  }

  async respond(input: SecurityInput): Promise<{ action: ResponseAction; steps: string[] }> {
    const threats = threatEngine.detect(input);
    return securityResponse.respond(threats);
  }

  async history(blueprintId: string, limit?: number) {
    return listSecurityHistory(blueprintId, limit);
  }

  formatSecurityContext(output: SecurityOutput): string {
    return [
      `Security: trust ${Math.round(output.trustScore * 100)}% (${output.trustLevel ?? "LIMITED"})`,
      `Decision: ${output.decision}`,
      `Risk ${Math.round(output.risk * 100)}%`,
      output.authorization?.allowed ? "Authorized" : "Not authorized",
      output.threats?.length ? `Threats: ${output.threats.filter((t) => t.threat !== "none").map((t) => t.threat).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Nothing executes until trusted. */
  async validateBeforeExecution(
    input: SecurityInput,
  ): Promise<{ allowed: boolean; reason?: string; output?: SecurityOutput }> {
    const output = await this.runCycle(input);

    if (output.decision === "deny") {
      return {
        allowed: false,
        reason: "Security default deny — trust or authorization insufficient",
        output,
      };
    }

    if (output.decision === "sandbox" && output.trustScore < 0.5) {
      return {
        allowed: false,
        reason: "Unknown execution must complete in sandbox with elevated trust",
        output,
      };
    }

    const topThreat = threatEngine.topSeverity(output.threats ?? []);
    if (topThreat === "LOCKDOWN" || topThreat === "CRITICAL") {
      return {
        allowed: false,
        reason: output.threats?.[0]?.containment ?? "Threat level blocks execution",
        output,
      };
    }

    if (!output.authorization?.allowed) {
      return {
        allowed: false,
        reason: "Authorization denied — capability or role insufficient",
        output,
      };
    }

    return { allowed: true, output };
  }

  private async runCycle(input: SecurityInput): Promise<SecurityOutput> {
    const sessionId = randomUUID();

    const policy = securityPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Security policy violation: ${policy.violations.join("; ")}`);
    }

    const subject = identityVerifier.identify(input);
    const trust = trustEngine.score(input);
    const capCheck = capabilityGuard.validate(input);
    const permission = input.requestedPermission ?? "execute";
    const authorization = authorizationEngine.authorize(input, trust.trustLevel, permission);
    const sandbox = sandboxEngine.evaluate(input);
    const threats = threatEngine.detect(input);
    const response = securityResponse.respond(threats);
    void response;
    void secretEngine.canAccess(false);

    const severityRisk: Record<string, number> = {
      LOW: 0.15,
      MEDIUM: 0.35,
      HIGH: 0.6,
      CRITICAL: 0.85,
      LOCKDOWN: 1,
    };
    const topThreat = threatEngine.topSeverity(threats);
    const risk = Math.min(1, severityRisk[topThreat] ?? 0.2 + (1 - trust.trustScore) * 0.3);

    let decision: SecurityDecision = "deny";
    if (!authorization.allowed || !capCheck.valid) {
      decision = "deny";
    } else if (topThreat === "LOCKDOWN" || topThreat === "CRITICAL") {
      decision = "deny";
    } else if (sandbox.required) {
      decision = "sandbox";
    } else if (authorization.approvals.length > 0) {
      decision = "escalate";
    } else if (trust.trustLevel !== "UNTRUSTED") {
      decision = "allow";
    }

    const permissions: SecurityPermission[] = authorization.allowed
      ? [permission, "read"]
      : [];

    const output: SecurityOutput = {
      sessionId,
      trustScore: trust.trustScore,
      risk,
      permissions,
      decision,
      trustLevel: trust.trustLevel,
      authorization,
      threats,
    };

    securityMemory.store(input.blueprintId, output);

    try {
      await persistSecurityVerify(output, input.blueprintId, subject.subjectId);
      await persistTrustProfile(input.blueprintId, subject.subjectId, trust);
      await persistPermission(input.blueprintId, subject.subjectId, permission, authorization);
      for (const t of threats) {
        await persistThreat(input.blueprintId, t);
      }
      void securityObservatory.snapshot(input, 1);
    } catch (err) {
      logger.warn({ err, sessionId }, "[SecurityEngine] persist skipped");
    }

    return output;
  }
}

export const securityEngine = new SecurityEngine();
