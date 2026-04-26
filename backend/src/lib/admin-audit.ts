import { supabaseAdmin } from "./supabase.js";

export type AdminAuditTarget = "verification_request" | "trainer" | "profile" | "ticket";

/**
 * Best-effort audit row; does not throw (main request should still succeed).
 */
export async function recordAdminAudit(input: {
  actorUserId: string;
  action: string;
  targetType: AdminAuditTarget;
  targetId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit_events").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    detail: input.detail ?? {},
  });
  if (error) {
    console.error("[admin-audit] insert failed:", error.message);
  }
}
