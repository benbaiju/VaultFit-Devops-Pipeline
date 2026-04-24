import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

const blockedDateSchema = z.object({
  blockedDate: z.iso.date(),
  reason: z.string().optional(),
});

export const availabilityRouter = Router();

availabilityRouter.get("/:trainerId/availability", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("trainer_availability")
    .select("*")
    .eq("trainer_id", req.params.trainerId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new HttpError(400, error.message, "AVAILABILITY_LIST_FAILED");
  res.json(data);
});

availabilityRouter.post("/:trainerId/availability", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const payload = availabilitySchema.parse(req.body);
  if (payload.startTime >= payload.endTime) {
    throw new HttpError(400, "startTime must be less than endTime", "INVALID_TIME_RANGE");
  }

  const trainerId = req.params.trainerId;
  const { data: trainer, error: trainerError } = await supabaseAdmin
    .from("trainers")
    .select("id, user_id")
    .eq("id", trainerId)
    .single();

  if (trainerError || !trainer) throw new HttpError(404, "Trainer not found", "TRAINER_NOT_FOUND");
  if (req.user!.role !== "admin" && trainer.user_id !== req.user!.id) {
    throw new HttpError(403, "Can only manage your own availability", "FORBIDDEN");
  }

  const { data, error } = await supabaseAdmin
    .from("trainer_availability")
    .insert({
      trainer_id: trainerId,
      day_of_week: payload.dayOfWeek,
      start_time: payload.startTime,
      end_time: payload.endTime,
    })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "AVAILABILITY_CREATE_FAILED");
  res.status(201).json(data);
});

availabilityRouter.delete(
  "/:trainerId/availability/:slotId",
  requireAuth,
  requireRole(["trainer", "admin"]),
  async (req, res) => {
    const trainerId = req.params.trainerId;

    const { data: trainer, error: trainerError } = await supabaseAdmin
      .from("trainers")
      .select("id, user_id")
      .eq("id", trainerId)
      .single();
    if (trainerError || !trainer) throw new HttpError(404, "Trainer not found", "TRAINER_NOT_FOUND");
    if (req.user!.role !== "admin" && trainer.user_id !== req.user!.id) {
      throw new HttpError(403, "Can only manage your own availability", "FORBIDDEN");
    }

    const { error } = await supabaseAdmin
      .from("trainer_availability")
      .delete()
      .eq("id", req.params.slotId)
      .eq("trainer_id", trainerId);
    if (error) throw new HttpError(400, error.message, "AVAILABILITY_DELETE_FAILED");
    res.status(204).send();
  },
);

availabilityRouter.get("/:trainerId/blocked-dates", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("blocked_dates")
    .select("*")
    .eq("trainer_id", req.params.trainerId)
    .order("blocked_date", { ascending: true });
  if (error) throw new HttpError(400, error.message, "BLOCKED_DATES_LIST_FAILED");
  res.json(data);
});

availabilityRouter.post("/:trainerId/blocked-dates", requireAuth, requireRole(["trainer", "admin"]), async (req, res) => {
  const payload = blockedDateSchema.parse(req.body);
  const trainerId = req.params.trainerId;

  const { data: trainer, error: trainerError } = await supabaseAdmin
    .from("trainers")
    .select("id, user_id")
    .eq("id", trainerId)
    .single();
  if (trainerError || !trainer) throw new HttpError(404, "Trainer not found", "TRAINER_NOT_FOUND");
  if (req.user!.role !== "admin" && trainer.user_id !== req.user!.id) {
    throw new HttpError(403, "Can only manage your own blocked dates", "FORBIDDEN");
  }

  const { data, error } = await supabaseAdmin
    .from("blocked_dates")
    .insert({
      trainer_id: trainerId,
      blocked_date: payload.blockedDate,
      reason: payload.reason ?? null,
    })
    .select("*")
    .single();
  if (error) throw new HttpError(400, error.message, "BLOCKED_DATE_CREATE_FAILED");
  res.status(201).json(data);
});

availabilityRouter.delete(
  "/:trainerId/blocked-dates/:blockedDateId",
  requireAuth,
  requireRole(["trainer", "admin"]),
  async (req, res) => {
    const trainerId = req.params.trainerId;

    const { data: trainer, error: trainerError } = await supabaseAdmin
      .from("trainers")
      .select("id, user_id")
      .eq("id", trainerId)
      .single();
    if (trainerError || !trainer) throw new HttpError(404, "Trainer not found", "TRAINER_NOT_FOUND");
    if (req.user!.role !== "admin" && trainer.user_id !== req.user!.id) {
      throw new HttpError(403, "Can only manage your own blocked dates", "FORBIDDEN");
    }

    const { error } = await supabaseAdmin
      .from("blocked_dates")
      .delete()
      .eq("id", req.params.blockedDateId)
      .eq("trainer_id", trainerId);
    if (error) throw new HttpError(400, error.message, "BLOCKED_DATE_DELETE_FAILED");
    res.status(204).send();
  },
);
