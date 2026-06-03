import { db, adminActionsLog } from "@workspace/db";

export async function logAdminAction(params: {
  adminEmail: string;
  actionType: string;
  targetUserId?: string | null;
  payload?: Record<string, unknown>;
  reason?: string;
}): Promise<void> {
  await db.insert(adminActionsLog).values({
    admin_email: params.adminEmail,
    action_type: params.actionType,
    target_user_id: params.targetUserId ?? null,
    payload: params.payload ?? null,
    reason: params.reason ?? null,
  });
}
