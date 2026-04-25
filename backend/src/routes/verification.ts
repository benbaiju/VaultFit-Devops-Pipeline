import { Router } from "express";
import { z } from "zod";
import { recordAdminAudit } from "../lib/admin-audit.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const submitVerificationSchema = z.object({
  credentialUrl: z.string().min(3),
  notes: z.string().max(2000).optional(),
});

const reviewVerificationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  adminNotes: z.string().max(2000).optional(),
});

export const verificationRouter = Router();

verificationRouter.post("/verification-requests", requireAuth, requireRole(["trainer"]), async (req, res) => {
  const payload = submitVerificationSchema.parse(req.body);
  const trainerId = await getTrainerIdOrThrow(req.user!.id, req.user!.role);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("verification_requests")
    .select("id, status")
    .eq("trainer_id", trainerId)
    .eq("status", "pending")
    .maybeSingle();
  if (existingError) throw new HttpError(400, existingError.message, "VERIFICATION_SUBMIT_FAILED");
  if (existing) throw new HttpError(409, "A pending verification request already exists", "VERIFICATION_PENDING_EXISTS");

  const { data, error } = await supabaseAdmin
    .from("verification_requests")
    .insert({
      trainer_id: trainerId,
      status: "pending",
      credential_url: payload.credentialUrl,
      admin_notes: payload.notes ?? null,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
    })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "VERIFICATION_SUBMIT_FAILED");
  res.status(201).json(data);
});

verificationRouter.get("/verification-requests/:id", requireAuth, async (req, res) => {
  const requestId = String(req.params.id);
  const { data, error } = await supabaseAdmin
    .from("verification_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (error || !data) throw new HttpError(404, "Verification request not found", "VERIFICATION_NOT_FOUND");

  if (req.user!.role !== "admin") {
    const trainerId = await getTrainerIdOrThrow(req.user!.id, req.user!.role);
    if (data.trainer_id !== trainerId) throw new HttpError(403, "Forbidden", "FORBIDDEN");
  }

  res.json(data);
});

verificationRouter.get("/admin/verification-requests", requireAuth, requireRole(["admin"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("verification_requests")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw new HttpError(400, error.message, "VERIFICATION_LIST_FAILED");
  res.json(data);
});

verificationRouter.patch("/admin/verification-requests/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const payload = reviewVerificationSchema.parse(req.body);
  const requestId = String(req.params.id);

  const { data: requestData, error: requestError } = await supabaseAdmin
    .from("verification_requests")
    .select("id, trainer_id, status")
    .eq("id", requestId)
    .single();
  if (requestError || !requestData) throw new HttpError(404, "Verification request not found", "VERIFICATION_NOT_FOUND");

  const { data, error } = await supabaseAdmin
    .from("verification_requests")
    .update({
      status: payload.status,
      admin_notes: payload.adminNotes ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("*")
    .single();
  if (error) throw new HttpError(400, error.message, "VERIFICATION_REVIEW_FAILED");

  const action = payload.status === "approved" ? "verification_approved" : "verification_rejected";
  void recordAdminAudit({
    actorUserId: req.user!.id,
    action,
    targetType: "verification_request",
    targetId: requestId,
    detail: {
      trainer_id: requestData.trainer_id,
      outcome: payload.status,
      admin_notes: payload.adminNotes ?? null,
    },
  });

  await supabaseAdmin
    .from("trainers")
    .update({ verified: payload.status === "approved" })
    .eq("id", requestData.trainer_id);

  const { data: trainerOwner } = await supabaseAdmin
    .from("trainers")
    .select("user_id")
    .eq("id", requestData.trainer_id)
    .maybeSingle();

  if (trainerOwner?.user_id) {
    await supabaseAdmin.from("notifications").insert({
      user_id: trainerOwner.user_id,
      title: "Verification update",
      body: payload.status === "approved" ? "Your verification has been approved." : "Your verification was rejected.",
      is_read: false,
    });
  }

  res.json(data);
});

verificationRouter.get("/admin/users", requireAuth, requireRole(["admin"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, created_at, access_suspended")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(400, error.message, "USERS_LIST_FAILED");
  res.json(data);
});

async function getTrainerIdOrThrow(userId: string, role: string | undefined): Promise<string> {
  if (role === "admin") throw new HttpError(400, "Invalid role for this endpoint", "INVALID_ROLE");
  const { data, error } = await supabaseAdmin.from("trainers").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new HttpError(404, "Trainer profile not found", "TRAINER_NOT_FOUND");
  return data.id;
}
