import type { SecurityInput } from "../contracts/types.js";

export class IdentityVerifier {
  identify(input: SecurityInput): { subjectId: string; verified: boolean; attributes: string[] } {
    const subjectId =
      input.actorId ??
      (typeof input.identity?.userId === "string" ? input.identity.userId : "anonymous");
    const verified = input.identity?.verified === true || Boolean(input.actorId);
    const attributes: string[] = [];
    if (input.identity?.role) attributes.push(`role:${input.identity.role}`);
    if (input.organization?.department) attributes.push(`dept:${input.organization.department}`);
    return { subjectId, verified, attributes };
  }
}

export const identityVerifier = new IdentityVerifier();
