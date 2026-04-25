import { Router } from "express";
import { z } from "zod";
import { recordAdminAudit } from "../lib/admin-audit.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const userAccessSchema = z.object({
  suspended: z.boolean(),
});

const trainerVerifiedSchema = z.object({
  verified: z.boolean(),
});

export const adminRouter = Router();

type TimelineItem = {
  source: "audit" | "legacy_verification";
  id: string;
  at: string;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown>;
  actor?: { id?: string; email?: string; full_name?: string | null };
};

adminRouter.get("/admin/review-timeline", requireAuth, requireRole(["admin"]), async (_req, res) => {
  const items: TimelineItem[] = [];
  const { data: auditRows, error: auditErr } = await supabaseAdmin
    .from("admin_audit_events")
    .select("id, action, target_type, target_id, detail, created_at, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(500);
  if (auditErr) {
    if (auditErr.message?.includes("admin_audit_events") || auditErr.message?.includes("column") || auditErr.message?.includes("relation")) {
      // Table missing: fall back to legacy verification only
      const { data: onlyLegacy } = await supabaseAdmin
        .from("verification_requests")
        .select("*")
        .in("status", ["approved", "rejected"])
        .order("reviewed_at", { ascending: false });
      for (const v of onlyLegacy ?? []) {
        if (!v.reviewed_at) continue;
        items.push(legacyVerificationItem(v));
      }
      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      return res.json({ items, warning: "admin_audit_events table missing; only legacy verification rows. Apply backend/supabase/migrations/20260225120000_admin_audit_events.sql" });
    }
    throw new HttpError(400, auditErr.message, "AUDIT_LIST_FAILED");
  }

  const actorIds = [...new Set((auditRows ?? []).map((e) => e.actor_user_id))];
  const { data: profs } =
    actorIds.length > 0
      ? await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", actorIds)
      : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

  const auditedVerificationIds = new Set(
    (auditRows ?? []).filter((e) => e.target_type === "verification_request").map((e) => e.target_id),
  );

  for (const e of auditRows ?? []) {
    const p = profMap.get(e.actor_user_id);
    items.push({
      source: "audit",
      id: e.id,
      at: e.created_at,
      action: e.action,
      target_type: e.target_type,
      target_id: e.target_id,
      detail: (e.detail as Record<string, unknown>) ?? {},
      actor: p ? { id: p.id, email: p.email, full_name: p.full_name } : { id: e.actor_user_id },
    });
  }

  const { data: legacyVer } = await supabaseAdmin
    .from("verification_requests")
    .select("*")
    .in("status", ["approved", "rejected"])
    .order("reviewed_at", { ascending: false })
    .limit(500);
  for (const v of legacyVer ?? []) {
    if (v.reviewed_at && !auditedVerificationIds.has(v.id)) {
      items.push(legacyVerificationItem(v));
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  res.json({ items });
});

function legacyVerificationItem(v: {
  id: string;
  status: string;
  trainer_id: string;
  credential_url: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  submitted_at?: string;
}): TimelineItem {
  const at = v.reviewed_at ?? v.submitted_at ?? new Date(0).toISOString();
  return {
    source: "legacy_verification",
    id: `legacy-vr-${v.id}`,
    at,
    action: v.status === "approved" ? "verification_approved" : "verification_rejected",
    target_type: "verification_request",
    target_id: v.id,
    detail: {
      trainer_id: v.trainer_id,
      outcome: v.status,
      admin_notes: v.admin_notes,
      credential_url: v.credential_url,
      note: "Logged before admin audit table existed",
    },
  };
}

adminRouter.patch(
  "/admin/users/:id/access",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const userId = String(req.params.id);
    if (userId === req.user!.id) {
      throw new HttpError(400, "You cannot change your own access from this action", "CANNOT_CHANGE_SELF");
    }

    const payload = userAccessSchema.parse(req.body);

    const { data: target, error: findError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();
    if (findError || !target) {
      throw new HttpError(404, "User not found", "USER_NOT_FOUND");
    }
    if (target.role === "admin") {
      throw new HttpError(400, "Cannot change access for other administrator accounts from the API", "CANNOT_CHANGE_ADMIN");
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ access_suspended: payload.suspended })
      .eq("id", userId)
      .select("id, email, full_name, role, created_at, access_suspended")
      .single();
    if (error) {
      if (error.message?.includes("access_suspended") || error.message?.includes("column")) {
        throw new HttpError(
          500,
          "Database is missing the access_suspended column. Apply backend/supabase/migrations/20260225000000_profiles_access_suspended.sql",
          "SCHEMA_OUTDATED",
        );
      }
      throw new HttpError(400, error.message, "ACCESS_UPDATE_FAILED");
    }
    void recordAdminAudit({
      actorUserId: req.user!.id,
      action: payload.suspended ? "user_access_blocked" : "user_access_restored",
      targetType: "profile",
      targetId: userId,
      detail: {
        target_email: data.email,
        target_role: data.role,
        access_suspended: data.access_suspended,
      },
    });
    res.json(data);
  },
);

adminRouter.get("/admin/trainers", requireAuth, requireRole(["admin"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("trainers")
    .select("id, user_id, verified, specialty, hourly_rate, bio, created_at, profiles:user_id(email, full_name, role)")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(400, error.message, "ADMIN_TRAINERS_LIST_FAILED");
  res.json(data);
});

adminRouter.patch(
  "/admin/trainers/:id/verified",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const trainerId = String(req.params.id);
    const payload = trainerVerifiedSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from("trainers")
      .update({ verified: payload.verified })
      .eq("id", trainerId)
      .select("id, user_id, verified, specialty, hourly_rate, bio, created_at, profiles:user_id(email, full_name, role)")
      .single();
    if (error) throw new HttpError(400, error.message, "TRAINER_VERIFIED_UPDATE_FAILED");
    if (!data) throw new HttpError(404, "Trainer not found", "TRAINER_NOT_FOUND");
    void recordAdminAudit({
      actorUserId: req.user!.id,
      action: payload.verified ? "trainer_verified_granted" : "trainer_verified_revoked",
      targetType: "trainer",
      targetId: trainerId,
      detail: {
        user_id: data.user_id,
        verified: data.verified,
        specialty: data.specialty,
        profile_email: (data as { profiles?: { email?: string } }).profiles?.email,
      },
    });
    res.json(data);
  },
);
