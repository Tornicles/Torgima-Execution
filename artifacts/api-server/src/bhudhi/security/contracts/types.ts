export type TrustLevel = "UNTRUSTED" | "LIMITED" | "TRUSTED" | "ELEVATED" | "SEALED";
export type CapabilityLevel = "PUBLIC" | "LIMITED" | "PRIVILEGED" | "CRITICAL" | "IMMUTABLE";
export type ThreatSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "LOCKDOWN";
export type SandboxMode = "STRICT" | "STANDARD" | "OPEN" | "AIRLOCK";
export type SecurityPermission = "read" | "execute" | "approve" | "delegate" | "recover";
export type ResponseAction = "warn" | "degrade" | "revoke" | "freeze" | "recover";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";
export type SecurityDecision = "allow" | "deny" | "escalate" | "sandbox";

export interface SecurityInput {
  blueprintId: string;
  identity?: Record<string, unknown>;
  governance?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  world?: Record<string, unknown>;
  organization?: Record<string, unknown>;
  capabilities?: Array<{
    capability: string;
    level: CapabilityLevel;
    scope?: string;
    expiration?: string;
  }>;
  actorId?: string;
  requestedPermission?: SecurityPermission;
  constraints?: string[];
}

export interface SecurityOutput {
  sessionId: string;
  trustScore: number;
  risk: number;
  permissions: SecurityPermission[];
  decision: SecurityDecision;
  trustLevel?: TrustLevel;
  authorization?: AuthorizationResult;
  threats?: ThreatResult[];
}

export interface TrustResult {
  trustScore: number;
  trustLevel: TrustLevel;
  reasons: string[];
  expiration: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  constraints: string[];
  approvals: string[];
}

export interface ThreatResult {
  threat: string;
  severity: ThreatSeverity;
  containment: string;
}

export interface CapabilityDeclaration {
  capability: string;
  level: CapabilityLevel;
  scope: string;
  expiration?: string;
}

export interface SecretRef {
  secretKey: string;
  secretType: string;
  vaultRef: string;
  expiresAt?: string;
  revoked: boolean;
}
