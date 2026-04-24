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

const openSlotsQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine((v) => v.from <= v.to, { message: "'from' must be before or equal to 'to'" });

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

availabilityRouter.get("/:trainerId/open-slots", async (req, res) => {
  const trainerId = String(req.params.trainerId);
  const query = openSlotsQuerySchema.parse({
    from: String(req.query.from),
    to: String(req.query.to),
  });

  const { data: availabilityRows, error: availabilityError } = await supabaseAdmin
    .from("trainer_availability")
    .select("day_of_week, start_time, end_time")
    .eq("trainer_id", trainerId);
  if (availabilityError) throw new HttpError(400, availabilityError.message, "OPEN_SLOTS_FAILED");

  const { data: blockedDates, error: blockedError } = await supabaseAdmin
    .from("blocked_dates")
    .select("blocked_date")
    .eq("trainer_id", trainerId)
    .gte("blocked_date", query.from)
    .lte("blocked_date", query.to);
  if (blockedError) throw new HttpError(400, blockedError.message, "OPEN_SLOTS_FAILED");

  const { data: bookings, error: bookingsError } = await supabaseAdmin
    .from("bookings")
    .select("booking_date, start_time, end_time, status")
    .eq("trainer_id", trainerId)
    .gte("booking_date", query.from)
    .lte("booking_date", query.to)
    .in("status", ["confirmed", "completed"]);
  if (bookingsError) throw new HttpError(400, bookingsError.message, "OPEN_SLOTS_FAILED");

  const blockedSet = new Set((blockedDates ?? []).map((b) => String(b.blocked_date)));
  const openSlots: Array<{ date: string; startTime: string; endTime: string }> = [];

  for (let d = new Date(`${query.from}T00:00:00`); d <= new Date(`${query.to}T00:00:00`); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    if (blockedSet.has(dateStr)) continue;

    const jsDay = d.getDay();
    const dayOfWeek = (jsDay + 6) % 7;
    const dayAvailability = (availabilityRows ?? []).filter((slot) => slot.day_of_week === dayOfWeek);
    if (dayAvailability.length === 0) continue;

    const dayBookings = (bookings ?? []).filter((b) => String(b.booking_date) === dateStr);
    const bookedRanges = dayBookings.map((b) => ({
      start: toMinutes(String(b.start_time)),
      end: toMinutes(String(b.end_time)),
    }));

    for (const slot of dayAvailability) {
      const base = [{ start: toMinutes(String(slot.start_time)), end: toMinutes(String(slot.end_time)) }];
      const remaining = subtractRanges(base, bookedRanges);
      for (const part of remaining) {
        if (part.start < part.end) {
          openSlots.push({
            date: dateStr,
            startTime: fromMinutes(part.start),
            endTime: fromMinutes(part.end),
          });
        }
      }
    }
  }

  res.json(openSlots);
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

function toMinutes(timeValue: string): number {
  const [h, m] = timeValue.split(":");
  return Number(h) * 60 + Number(m);
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:00`;
}

type Range = { start: number; end: number };

function subtractRanges(baseRanges: Range[], removeRanges: Range[]): Range[] {
  let result = [...baseRanges];
  for (const remove of removeRanges) {
    const next: Range[] = [];
    for (const current of result) {
      if (remove.end <= current.start || remove.start >= current.end) {
        next.push(current);
        continue;
      }
      if (remove.start > current.start) {
        next.push({ start: current.start, end: remove.start });
      }
      if (remove.end < current.end) {
        next.push({ start: remove.end, end: current.end });
      }
    }
    result = next;
  }
  return result;
}

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
