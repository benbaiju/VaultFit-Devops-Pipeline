import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { recordAdminAudit } from "../lib/admin-audit.js";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const submitVerificationSchema = z.object({
  credentialUrl: z.string().min(3).optional(),
  identityUrl: z.string().min(3).optional(),
  notes: z.string().max(2000).optional(),
});

const reviewVerificationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  adminNotes: z.string().max(2000).optional(),
});

export const verificationRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function parseStoredCredentialRef(value: string): { bucket: string; objectPath: string } | null {
  if (!value.startsWith("storage://")) return null;
  const withoutPrefix = value.slice("storage://".length);
  const slashIdx = withoutPrefix.indexOf("/");
  if (slashIdx <= 0) return null;
  return {
    bucket: withoutPrefix.slice(0, slashIdx),
    objectPath: withoutPrefix.slice(slashIdx + 1),
  };
}

function pickCredentialRef(input: { uploaded?: string; provided?: string }): string {
  return (input.uploaded ?? input.provided ?? "").trim();
}

function ensureVerificationDocs(payload: { credentialRef: string; identityRef: string }) {
  if (!payload.credentialRef || !payload.identityRef) {
    throw new HttpError(
      400,
      "Both credential and identity documents are required (URL or uploaded file for each).",
      "VERIFICATION_DOCS_REQUIRED",
    );
  }
}

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

  const credentialRef = pickCredentialRef({ provided: payload.credentialUrl });
  const identityRef = pickCredentialRef({ provided: payload.identityUrl });
  ensureVerificationDocs({ credentialRef, identityRef });

  const { data, error } = await supabaseAdmin
    .from("verification_requests")
    .insert({
      trainer_id: trainerId,
      status: "pending",
      credential_url: credentialRef,
      identity_url: identityRef,
      admin_notes: payload.notes ?? null,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
    })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "VERIFICATION_SUBMIT_FAILED");
  res.status(201).json(data);
});

verificationRouter.post(
  "/verification-requests/upload",
  requireAuth,
  requireRole(["trainer"]),
  upload.fields([
    { name: "credentialDocument", maxCount: 1 },
    { name: "identityDocument", maxCount: 1 },
  ]),
  async (req, res) => {
    const trainerId = await getTrainerIdOrThrow(req.user!.id, req.user!.role);
    const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 2000) : undefined;
    const bodyCredentialUrl = typeof req.body?.credentialUrl === "string" ? req.body.credentialUrl.trim() : "";
    const bodyIdentityUrl = typeof req.body?.identityUrl === "string" ? req.body.identityUrl.trim() : "";
    const filesMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const credentialFile = filesMap.credentialDocument?.[0];
    const identityFile = filesMap.identityDocument?.[0];

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("verification_requests")
      .select("id, status")
      .eq("trainer_id", trainerId)
      .eq("status", "pending")
      .maybeSingle();
    if (existingError) throw new HttpError(400, existingError.message, "VERIFICATION_SUBMIT_FAILED");
    if (existing) throw new HttpError(409, "A pending verification request already exists", "VERIFICATION_PENDING_EXISTS");

    let uploadedCredentialRef = "";
    if (credentialFile) {
      const fileName = sanitizeFilename(credentialFile.originalname || "credential.bin");
      const objectPath = `${trainerId}/credentials/${Date.now()}-${fileName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(env.verificationDocsBucket)
        .upload(objectPath, credentialFile.buffer, {
          contentType: credentialFile.mimetype || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) {
        throw new HttpError(400, uploadError.message, "VERIFICATION_FILE_UPLOAD_FAILED");
      }
      uploadedCredentialRef = `storage://${env.verificationDocsBucket}/${objectPath}`;
    }
    let uploadedIdentityRef = "";
    if (identityFile) {
      const fileName = sanitizeFilename(identityFile.originalname || "identity.bin");
      const objectPath = `${trainerId}/identity/${Date.now()}-${fileName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(env.verificationDocsBucket)
        .upload(objectPath, identityFile.buffer, {
          contentType: identityFile.mimetype || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) {
        throw new HttpError(400, uploadError.message, "VERIFICATION_FILE_UPLOAD_FAILED");
      }
      uploadedIdentityRef = `storage://${env.verificationDocsBucket}/${objectPath}`;
    }

    const credentialRef = pickCredentialRef({ uploaded: uploadedCredentialRef, provided: bodyCredentialUrl });
    const identityRef = pickCredentialRef({ uploaded: uploadedIdentityRef, provided: bodyIdentityUrl });
    ensureVerificationDocs({ credentialRef, identityRef });
    const { data, error } = await supabaseAdmin
      .from("verification_requests")
      .insert({
        trainer_id: trainerId,
        status: "pending",
        credential_url: credentialRef,
        identity_url: identityRef,
        admin_notes: notes ?? null,
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
      })
      .select("*")
      .single();
    if (error) throw new HttpError(400, error.message, "VERIFICATION_SUBMIT_FAILED");
    res.status(201).json(data);
  },
);

verificationRouter.get("/verification-requests/me", requireAuth, requireRole(["trainer"]), async (req, res) => {
  const trainerId = await getTrainerIdOrThrow(req.user!.id, req.user!.role);
  const { data, error } = await supabaseAdmin
    .from("verification_requests")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("submitted_at", { ascending: false });
  if (error) throw new HttpError(400, error.message, "VERIFICATION_LIST_FAILED");
  res.json(data);
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

verificationRouter.get("/verification-requests/:id/document-url", requireAuth, async (req, res) => {
  const type = req.query.type === "identity" ? "identity" : "credential";
  const requestId = String(req.params.id);
  const { data, error } = await supabaseAdmin
    .from("verification_requests")
    .select("id, trainer_id, credential_url, identity_url")
    .eq("id", requestId)
    .single();
  if (error || !data) throw new HttpError(404, "Verification request not found", "VERIFICATION_NOT_FOUND");

  if (req.user!.role !== "admin") {
    const trainerId = await getTrainerIdOrThrow(req.user!.id, req.user!.role);
    if (data.trainer_id !== trainerId) throw new HttpError(403, "Forbidden", "FORBIDDEN");
  }

  // Backward compatibility: old rows may store direct external URLs.
  const ref = type === "identity" ? data.identity_url : data.credential_url;
  if (!ref) {
    throw new HttpError(404, `${type} document not found`, "VERIFICATION_DOC_NOT_FOUND");
  }
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    res.json({ url: ref, source: "direct" });
    return;
  }

  const parsed = parseStoredCredentialRef(ref);
  if (!parsed) {
    throw new HttpError(400, `${type} document reference is invalid`, "VERIFICATION_DOC_REF_INVALID");
  }
  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.objectPath, 60 * 15);
  if (signedError || !signed?.signedUrl) {
    throw new HttpError(400, signedError?.message ?? "Could not sign document URL", "VERIFICATION_DOC_SIGN_FAILED");
  }
  res.json({ url: signed.signedUrl, source: "signed" });
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
    .select("id, trainer_id, status, credential_url, identity_url")
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
      credential_url: requestData.credential_url,
      identity_url: requestData.identity_url,
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
