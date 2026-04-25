import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { ensureVerifiedTrainerUser, requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const createPlanSchema = z.object({
  clientId: z.uuid(),
  trainerId: z.uuid().optional(),
  title: z.string().min(2).max(200),
  planType: z.enum(["fitness", "nutrition", "hybrid"]),
  content: z.unknown(),
});

const updatePlanSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  planType: z.enum(["fitness", "nutrition", "hybrid"]).optional(),
  content: z.unknown().optional(),
});

export const plansRouter = Router();

plansRouter.post("/", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const payload = createPlanSchema.parse(req.body);

  if (req.user!.role === "trainer") await ensureVerifiedTrainerUser(req.user!.id);
  const trainerId = await resolveTrainerId(req.user!.id, req.user!.role, payload.trainerId);
  if (!trainerId) {
    throw new HttpError(400, "Trainer profile is required to create plans", "TRAINER_PROFILE_MISSING");
  }

  const { data, error } = await supabaseAdmin
    .from("plans")
    .insert({
      client_id: payload.clientId,
      trainer_id: trainerId,
      title: payload.title,
      plan_type: payload.planType,
      content: payload.content,
    })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "PLAN_CREATE_FAILED");
  res.status(201).json(data);
});

plansRouter.get("/", requireAuth, async (req, res) => {
  let query = supabaseAdmin.from("plans").select("*").order("created_at", { ascending: false });

  if (req.user!.role === "client") {
    query = query.eq("client_id", req.user!.id);
  } else if (req.user!.role === "trainer") {
    const trainerId = await resolveTrainerId(req.user!.id, req.user!.role);
    if (!trainerId) throw new HttpError(400, "Trainer profile not found", "TRAINER_PROFILE_MISSING");
    query = query.eq("trainer_id", trainerId);
  }

  const { data, error } = await query;
  if (error) throw new HttpError(400, error.message, "PLANS_LIST_FAILED");
  res.json(data);
});

plansRouter.get("/:id", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from("plans").select("*").eq("id", req.params.id).single();
  if (error || !data) throw new HttpError(404, "Plan not found", "PLAN_NOT_FOUND");

  await ensurePlanAccess(req.user!.id, req.user!.role, data);
  res.json(data);
});

plansRouter.put("/:id", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const payload = updatePlanSchema.parse(req.body);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", req.params.id)
    .single();
  if (existingError || !existing) throw new HttpError(404, "Plan not found", "PLAN_NOT_FOUND");

  await ensurePlanEditAccess(req.user!.id, req.user!.role, existing.trainer_id);
  if (req.user!.role === "trainer") await ensureVerifiedTrainerUser(req.user!.id);

  const { data, error } = await supabaseAdmin
    .from("plans")
    .update({
      title: payload.title,
      plan_type: payload.planType,
      content: payload.content,
    })
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "PLAN_UPDATE_FAILED");
  res.json(data);
});

plansRouter.delete("/:id", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("plans")
    .select("id, trainer_id")
    .eq("id", req.params.id)
    .single();
  if (existingError || !existing) throw new HttpError(404, "Plan not found", "PLAN_NOT_FOUND");

  await ensurePlanEditAccess(req.user!.id, req.user!.role, existing.trainer_id);
  if (req.user!.role === "trainer") await ensureVerifiedTrainerUser(req.user!.id);

  const { error } = await supabaseAdmin.from("plans").delete().eq("id", req.params.id);
  if (error) throw new HttpError(400, error.message, "PLAN_DELETE_FAILED");
  res.status(204).send();
});

async function resolveTrainerId(userId: string, role: string | undefined, adminProvidedTrainerId?: string): Promise<string | null> {
  if (role === "admin" && adminProvidedTrainerId) return adminProvidedTrainerId;
  if (role !== "trainer") return null;

  const { data, error } = await supabaseAdmin.from("trainers").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return data.id;
}

async function ensurePlanAccess(userId: string, role: string | undefined, plan: { client_id: string; trainer_id: string }) {
  if (role === "admin") return;
  if (role === "client" && plan.client_id === userId) return;
  if (role === "trainer") {
    const trainerId = await resolveTrainerId(userId, role);
    if (trainerId && trainerId === plan.trainer_id) return;
  }
  throw new HttpError(403, "Forbidden", "FORBIDDEN");
}

async function ensurePlanEditAccess(userId: string, role: string | undefined, planTrainerId: string) {
  if (role === "admin") return;
  const trainerId = await resolveTrainerId(userId, role);
  if (trainerId && trainerId === planTrainerId) return;
  throw new HttpError(403, "Only plan owner trainer can edit this plan", "FORBIDDEN");
}
