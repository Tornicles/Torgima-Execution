export type AuthClass =
  | "PUBLIC"
  | "OPTIONAL_SESSION"
  | "USER_SESSION"
  | "INTERNAL_SERVICE"
  | "WEBHOOK_SOURCE"
  | "ADMIN_INTERNAL";

export interface AuthSession {
  id: string;
  userId: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface AuthContext {
  userId: string;
  sessionId: string;
  userMode: "individual" | "team";
  userTier: string;
  isInternal: boolean;
}

export interface SafeUser {
  id: string;
  email: string;
  displayName: string | null;
  mode: string;
  tier: string;
  onboardingComplete: boolean;
  timezone: string;
  notificationPreferences: Record<string, unknown>;
}
