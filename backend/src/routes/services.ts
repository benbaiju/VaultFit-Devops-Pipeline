import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const createServiceSchema = z.object({
  title: z.string().min(2).max(200),
  serviceType: z.enum(["session", "program", "consultation"]).default("session"),
  durationMinutes: z.number().int().min(15).max(480),
  price: z.number().min(0),
  isActive: z.boolean().default(true),
});

const updateServiceSchema = createServiceSchema.partial();

export const servicesRouter = Router();

servicesRouter.get("/:trainerId/services", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("*")
    .eq("trainer_id", req.params.trainerId)
    .order("created_at", { ascending: false });

  if (error) throw new HttpError(400, error.message, "SERVICES_LIST_FAILED");
  res.json(data);
});

servicesRouter.post("/:trainerId/services", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const payload = createServiceSchema.parse(req.body);
  const trainerId = String(req.params.trainerId);
  const trainer = await getTrainerOrThrow(trainerId);
  ensureTrainerOwnership(req.user!.id, req.user!.role, trainer.user_id);

  const { data, error } = await supabaseAdmin
    .from("services")
    .insert({
      trainer_id: trainerId,
      title: payload.title,
      service_type: payload.serviceType,
      duration_minutes: payload.durationMinutes,
      price: payload.price,
      is_active: payload.isActive,
    })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "SERVICE_CREATE_FAILED");
  res.status(201).json(data);
});

servicesRouter.put(
  "/:trainerId/services/:serviceId",
  requireAuth,
  requireRole(["trainer", "admin"]),
  async (req, res) => {
    const payload = updateServiceSchema.parse(req.body);
    const trainerId = String(req.params.trainerId);
    const serviceId = String(req.params.serviceId);
    const trainer = await getTrainerOrThrow(trainerId);
    ensureTrainerOwnership(req.user!.id, req.user!.role, trainer.user_id);

    const { data, error } = await supabaseAdmin
      .from("services")
      .update({
        title: payload.title,
        service_type: payload.serviceType,
        duration_minutes: payload.durationMinutes,
        price: payload.price,
        is_active: payload.isActive,
      })
      .eq("id", serviceId)
      .eq("trainer_id", trainerId)
      .select("*")
      .single();

    if (error) throw new HttpError(400, error.message, "SERVICE_UPDATE_FAILED");
    res.json(data);
  },
);

servicesRouter.delete(
  "/:trainerId/services/:serviceId",
  requireAuth,
  requireRole(["trainer", "admin"]),
  async (req, res) => {
    const trainerId = String(req.params.trainerId);
    const serviceId = String(req.params.serviceId);
    const trainer = await getTrainerOrThrow(trainerId);
    ensureTrainerOwnership(req.user!.id, req.user!.role, trainer.user_id);

    const { error } = await supabaseAdmin
      .from("services")
      .delete()
      .eq("id", serviceId)
      .eq("trainer_id", trainerId);

    if (error) throw new HttpError(400, error.message, "SERVICE_DELETE_FAILED");
    res.status(204).send();
  },
);

async function getTrainerOrThrow(trainerId: string) {
  const { data, error } = await supabaseAdmin.from("trainers").select("id, user_id").eq("id", trainerId).single();
  if (error || !data) throw new HttpError(404, "Trainer not found", "TRAINER_NOT_FOUND");
  return data;
}

function ensureTrainerOwnership(requestUserId: string, role: string | undefined, trainerUserId: string) {
  if (role === "admin") return;
  if (trainerUserId !== requestUserId) {
    throw new HttpError(403, "Can only manage your own services", "FORBIDDEN");
  }
}
