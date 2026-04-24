import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const createBookingSchema = z.object({
  trainerId: z.uuid(),
  bookingDate: z.iso.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});

export const bookingsRouter = Router();

bookingsRouter.get("/", requireAuth, async (req, res) => {
  const { data: trainer } = await supabaseAdmin.from("trainers").select("id").eq("user_id", req.user!.id).maybeSingle();

  const query = supabaseAdmin.from("bookings").select("*").order("created_at", { ascending: false });
  const { data, error } = trainer
    ? await query.or(`client_id.eq.${req.user!.id},trainer_id.eq.${trainer.id}`)
    : await query.eq("client_id", req.user!.id);

  if (error) throw new HttpError(400, error.message, "BOOKINGS_LIST_FAILED");
  res.json(data);
});

bookingsRouter.post("/", requireAuth, async (req, res) => {
  const payload = createBookingSchema.parse(req.body);
  if (payload.startTime >= payload.endTime) {
    throw new HttpError(400, "startTime must be less than endTime", "INVALID_TIME_RANGE");
  }

  const bookingDate = new Date(`${payload.bookingDate}T00:00:00`);
  const jsDay = bookingDate.getDay();
  const dayOfWeek = (jsDay + 6) % 7; // convert JS 0=Sun..6=Sat to schema 0=Mon..6=Sun

  const { data: blocked, error: blockedError } = await supabaseAdmin
    .from("blocked_dates")
    .select("id")
    .eq("trainer_id", payload.trainerId)
    .eq("blocked_date", payload.bookingDate)
    .maybeSingle();
  if (blockedError) throw new HttpError(400, blockedError.message, "BOOKING_CREATE_FAILED");
  if (blocked) throw new HttpError(409, "Trainer is unavailable on this date", "DATE_BLOCKED");

  const { data: slots, error: slotsError } = await supabaseAdmin
    .from("trainer_availability")
    .select("id, start_time, end_time")
    .eq("trainer_id", payload.trainerId)
    .eq("day_of_week", dayOfWeek);
  if (slotsError) throw new HttpError(400, slotsError.message, "BOOKING_CREATE_FAILED");

  const inAvailability = (slots ?? []).some(
    (slot) => payload.startTime >= slot.start_time && payload.endTime <= slot.end_time,
  );
  if (!inAvailability) {
    throw new HttpError(409, "Requested time is outside trainer availability", "OUTSIDE_AVAILABILITY");
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      client_id: req.user!.id,
      trainer_id: payload.trainerId,
      booking_date: payload.bookingDate,
      start_time: payload.startTime,
      end_time: payload.endTime,
      notes: payload.notes,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "BOOKING_CREATE_FAILED");
  res.status(201).json(data);
});

bookingsRouter.patch("/:id/status", requireAuth, async (req, res) => {
  const payload = updateStatusSchema.parse(req.body);

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, client_id, trainer_id, status")
    .eq("id", req.params.id)
    .single();
  if (bookingError || !booking) throw new HttpError(404, "Booking not found", "BOOKING_NOT_FOUND");

  const { data: trainer } = await supabaseAdmin
    .from("trainers")
    .select("id")
    .eq("id", booking.trainer_id)
    .eq("user_id", req.user!.id)
    .maybeSingle();

  const isClient = booking.client_id === req.user!.id;
  const isTrainer = Boolean(trainer);
  if (!isClient && !isTrainer) throw new HttpError(403, "Forbidden", "FORBIDDEN");

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({ status: payload.status })
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error) throw new HttpError(400, error.message, "BOOKING_STATUS_UPDATE_FAILED");
  res.json(data);
});
