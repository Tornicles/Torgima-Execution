import { createHash } from "node:crypto";
import type { SecretRef } from "../contracts/types.js";

export class SecretEngine {
  /** Vault reference only — no plaintext persistence. */
  register(blueprintId: string, secretKey: string, secretType: string): SecretRef {
    const vaultRef = `vault://${blueprintId}/${createHash("sha256").update(secretKey).digest("hex").slice(0, 16)}`;
    const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    return {
      secretKey,
      secretType,
      vaultRef,
      expiresAt,
      revoked: false,
    };
  }

  rotate(ref: SecretRef): SecretRef {
    return {
      ...ref,
      vaultRef: `${ref.vaultRef}/rotated-${Date.now()}`,
      expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      revoked: false,
    };
  }

  revoke(ref: SecretRef): SecretRef {
    return { ...ref, revoked: true };
  }

  canAccess(directRead: boolean): boolean {
    return !directRead;
  }
}

export const secretEngine = new SecretEngine();
