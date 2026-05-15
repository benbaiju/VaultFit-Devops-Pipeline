import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { ensureVerifiedTrainerUser } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { tagRouteModule } from "../middleware/route-module.js";

const createBookingSchema = z.object({
  trainerId: z.uuid(),
  serviceId: z.uuid(),
  bookingDate: z.iso.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});

export const bookingsRouter = Router();
bookingsRouter.use(tagRouteModule("bookings"));

bookingsRouter.get("/", requireAuth, async (req, res) => {
  const { data: trainer } = await supabaseAdmin.from("trainers").select("id").eq("user_id", req.user!.id).maybeSingle();

  const query = supabaseAdmin.from("bookings").select("*").order("created_at", { ascending: false });
  const { data: rows, error } = trainer
    ? await query.or(`client_id.eq.${req.user!.id},trainer_id.eq.${trainer.id}`)
    : await query.eq("client_id", req.user!.id);

  if (error) throw new HttpError(400, error.message, "BOOKINGS_LIST_FAILED");

  const bookings = rows ?? [];
  const trainerIds = [...new Set(bookings.map((b) => b.trainer_id).filter((id): id is string => Boolean(id)))];
  const clientIds = [...new Set(bookings.map((b) => b.client_id).filter((id): id is string => Boolean(id)))];

  const trainersFetchPromise =
    trainerIds.length === 0
      ? Promise.resolve({ data: [] as { id: string; profiles?: { full_name?: string | null } | null }[], error: null })
      : supabaseAdmin.from("trainers").select("id, profiles:user_id(full_name)").in("id", trainerIds);

  const clientsFetchPromise =
    clientIds.length === 0
      ? Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null })
      : supabaseAdmin.from("profiles").select("id, full_name").in("id", clientIds);

  const [trainersResult, clientsResult] = await Promise.all([trainersFetchPromise, clientsFetchPromise]);

  if (trainersResult.error) throw new HttpError(400, trainersResult.error.message, "BOOKINGS_LIST_FAILED");
  if (clientsResult.error) throw new HttpError(400, clientsResult.error.message, "BOOKINGS_LIST_FAILED");

  const trainerNameById = new Map<string, string>();
  for (const t of trainersResult.data ?? []) {
    const raw = t.profiles as { full_name?: string | null } | { full_name?: string | null }[] | null | undefined;
    const prof = Array.isArray(raw) ? raw[0] : raw;
    const name = prof?.full_name?.trim();
    trainerNameById.set(t.id, name || "Trainer");
  }

  const clientNameById = new Map<string, string>();
  for (const p of clientsResult.data ?? []) {
    const name = p.full_name?.trim();
    clientNameById.set(p.id, name || "Client");
  }

  const enriched = bookings.map((b) => ({
    ...b,
    trainer_display_name: b.trainer_id ? trainerNameById.get(b.trainer_id) ?? null : null,
    client_display_name: b.client_id ? clientNameById.get(b.client_id) ?? null : null,
  }));

  res.json(enriched);
});

bookingsRouter.post("/", requireAuth, async (req, res) => {
  const payload = createBookingSchema.parse(req.body);
  if (payload.startTime >= payload.endTime) {
    throw new HttpError(400, "startTime must be less than endTime", "INVALID_TIME_RANGE");
  }

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, trainer_id, is_active")
    .eq("id", payload.serviceId)
    .single();
  if (serviceError || !service) throw new HttpError(404, "Service not found", "SERVICE_NOT_FOUND");
  if (service.trainer_id !== payload.trainerId) {
    throw new HttpError(400, "Selected service does not belong to this trainer", "SERVICE_TRAINER_MISMATCH");
  }
  if (!service.is_active) {
    throw new HttpError(409, "Selected service is not active", "SERVICE_INACTIVE");
  }

  const bookingDate = new Date(`${payload.bookingDate}T00:00:00`);
  const jsDay = bookingDate.getDay();
  const dayOfWeek = (jsDay + 6) % 7; // convert JS 0=Sun..6=Sat to schema 0=Mon..6=Sun

  const { data: blocked, error: blockedError } = await supabaseAdmin
    .from("blocked_dates")
    .select("id")
    .eq("trainer_id", payload.trainerId)
    .eq("service_id", payload.serviceId)
    .eq("blocked_date", payload.bookingDate)
    .maybeSingle();
  if (blockedError) throw new HttpError(400, blockedError.message, "BOOKING_CREATE_FAILED");
  if (blocked) throw new HttpError(409, "Service is unavailable on this date", "DATE_BLOCKED");

  const { data: slots, error: slotsError } = await supabaseAdmin
    .from("trainer_availability")
    .select("id, start_time, end_time")
    .eq("trainer_id", payload.trainerId)
    .eq("service_id", payload.serviceId)
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
      service_id: payload.serviceId,
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
    .select("id, user_id, verified")
    .eq("id", booking.trainer_id)
    .eq("user_id", req.user!.id)
    .maybeSingle();

  const isClient = booking.client_id === req.user!.id;
  const isTrainer = Boolean(trainer);
  if (!isClient && !isTrainer) throw new HttpError(403, "Forbidden", "FORBIDDEN");
  if (isTrainer) await ensureVerifiedTrainerUser(req.user!.id);

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({ status: payload.status })
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error) throw new HttpError(400, error.message, "BOOKING_STATUS_UPDATE_FAILED");
  res.json(data);
});
