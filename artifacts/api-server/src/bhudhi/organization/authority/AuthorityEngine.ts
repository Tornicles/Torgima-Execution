import type { AuthorityLevel, OrgInput, Permission } from "../contracts/types.js";

const LEVEL_PERMISSIONS: Record<AuthorityLevel, Permission[]> = {
  OWNER: ["read", "approve", "execute", "delegate", "freeze", "escalate"],
  EXECUTIVE: ["read", "approve", "execute", "delegate", "escalate"],
  MANAGER: ["read", "approve", "execute", "delegate"],
  LEAD: ["read", "approve", "execute"],
  MEMBER: ["read", "execute"],
  OBSERVER: ["read"],
};

export class AuthorityEngine {
  /** Authority is explicit — never inferred. */
  resolve(level: AuthorityLevel): Permission[] {
    return [...LEVEL_PERMISSIONS[level]];
  }

  can(level: AuthorityLevel, permission: Permission): boolean {
    return this.resolve(level).includes(permission);
  }

  assignFromInput(input: OrgInput): Array<{
    userId?: string;
    roleKey: string;
    authority: AuthorityLevel;
    permissions: Permission[];
    department?: string;
  }> {
    const assignments: Array<{
      userId?: string;
      roleKey: string;
      authority: AuthorityLevel;
      permissions: Permission[];
      department?: string;
    }> = [];

    for (const u of input.users ?? []) {
      const authority = this.parseLevel(u.role);
      assignments.push({
        userId: u.userId,
        roleKey: u.role ?? "member",
        authority,
        permissions: this.resolve(authority),
        department: u.department,
      });
    }

    for (const r of input.roles ?? []) {
      assignments.push({
        roleKey: r.roleKey,
        authority: r.authority,
        permissions: this.resolve(r.authority),
        department: r.department,
      });
    }

    if (assignments.length === 0) {
      assignments.push({
        roleKey: "default_owner",
        authority: "OWNER",
        permissions: this.resolve("OWNER"),
        department: "strategy",
      });
    }

    return assignments;
  }

  private parseLevel(role?: string): AuthorityLevel {
    const r = (role ?? "").toUpperCase();
    if (r.includes("OWNER")) return "OWNER";
    if (r.includes("EXEC")) return "EXECUTIVE";
    if (r.includes("MANAGER")) return "MANAGER";
    if (r.includes("LEAD")) return "LEAD";
    if (r.includes("OBSERVER")) return "OBSERVER";
    return "MEMBER";
  }
}

export const authorityEngine = new AuthorityEngine();
