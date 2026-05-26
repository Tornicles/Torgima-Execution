import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export type GovernanceHealth = {
  trustScore: number;
  activeEmergency: string | null;
  pendingApprovals: number;
  recentViolations: number;
  auditEvents24h: number;
  policiesImmutable: boolean;
};

export async function fetchGovernanceHealth(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    health: GovernanceHealth;
    pendingApprovals: Array<{
      id: string;
      action: string;
      level: string;
      subject_id: string;
      status: string;
    }>;
    immutableLaws: string[];
  }>(`/api/bhudhi/governance/health?blueprintId=${encodeURIComponent(blueprintId)}`);
  return unwrap(res);
}

export async function runGovernanceCheck(body: {
  actor: { type: string; id: string };
  action: string;
  blueprintId?: string;
  recommendationId?: string;
  confidence?: number;
}) {
  const res = await apiFetchEnvelope<{ check: { allowed: boolean; explanation: { why: string } } }>(
    "/api/bhudhi/governance/check",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return unwrap(res);
}

export async function fetchGovernanceAudit(blueprintId: string, limit = 30) {
  const res = await apiFetchEnvelope<{ events: unknown[]; count: number }>(
    "/api/bhudhi/governance/audit",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, limit }),
    },
  );
  return unwrap(res);
}

export async function grantGovernanceApproval(approvalId: string, blueprintId: string) {
  const res = await apiFetchEnvelope<{ granted: boolean; reason?: string }>(
    "/api/bhudhi/governance/approve",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, blueprintId, level: "L2" }),
    },
  );
  return unwrap(res);
}
