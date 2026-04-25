import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const createTrainerSchema = z.object({
  bio: z.string().optional(),
  specialty: z.string().optional(),
  experienceYears: z.number().int().min(0).default(0),
  hourlyRate: z.number().min(0).default(0),
});

const updateTrainerSchema = createTrainerSchema.partial();

export const trainersRouter = Router();

trainersRouter.get("/", async (req, res) => {
  const specialty = req.query.specialty as string | undefined;
  const verified = req.query.verified as string | undefined;

  let query = supabaseAdmin.from("trainers").select("*, profiles:user_id(full_name, avatar_url)");
  if (specialty) query = query.eq("specialty", specialty);
  if (verified === "true") query = query.eq("verified", true);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new HttpError(400, error.message, "TRAINERS_LIST_FAILED");
  res.json(data);
});

trainersRouter.get("/me/profile", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("trainers")
    .select("*, profiles:user_id(full_name, avatar_url)")
    .eq("user_id", req.user!.id)
    .maybeSingle();
  if (error) throw new HttpError(400, error.message, "TRAINER_READ_FAILED");
  res.json(data ?? null);
});

trainersRouter.get("/:id", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("trainers")
    .select("*, profiles:user_id(full_name, avatar_url)")
    .eq("id", req.params.id)
    .single();
  if (error) throw new HttpError(404, "Trainer not found", "TRAINER_NOT_FOUND");
  res.json(data);
});

trainersRouter.post("/", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const payload = createTrainerSchema.parse(req.body);
  const { data, error } = await supabaseAdmin
    .from("trainers")
    .insert({
      user_id: req.user!.id,
      bio: payload.bio,
      specialty: payload.specialty,
      experience_years: payload.experienceYears,
      hourly_rate: payload.hourlyRate,
    })
    .select("*")
    .single();
  if (error) throw new HttpError(400, error.message, "TRAINER_CREATE_FAILED");
  res.status(201).json(data);
});

trainersRouter.put("/:id", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const payload = updateTrainerSchema.parse(req.body);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("trainers")
    .select("id, user_id")
    .eq("id", req.params.id)
    .single();
  if (existingError || !existing) throw new HttpError(404, "Trainer not found", "TRAINER_NOT_FOUND");
  if (req.user!.role !== "admin" && existing.user_id !== req.user!.id) {
    throw new HttpError(403, "Can only update your own trainer profile", "FORBIDDEN");
  }

  const { data, error } = await supabaseAdmin
    .from("trainers")
    .update({
      bio: payload.bio,
      specialty: payload.specialty,
      experience_years: payload.experienceYears,
      hourly_rate: payload.hourlyRate,
    })
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error) throw new HttpError(400, error.message, "TRAINER_UPDATE_FAILED");
  res.json(data);
});
