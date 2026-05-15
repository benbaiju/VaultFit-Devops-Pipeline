import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { tagRouteModule } from "../middleware/route-module.js";

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export const reviewsRouter = Router();
reviewsRouter.use(tagRouteModule("reviews"));

reviewsRouter.post("/bookings/:id/review", requireAuth, async (req, res) => {
  const payload = createReviewSchema.parse(req.body);

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, client_id, trainer_id, status")
    .eq("id", req.params.id)
    .single();

  if (bookingError || !booking) {
    throw new HttpError(404, "Booking not found", "BOOKING_NOT_FOUND");
  }
  if (booking.client_id !== req.user!.id) {
    throw new HttpError(403, "Only booking owner can review", "FORBIDDEN");
  }
  if (booking.status !== "completed") {
    throw new HttpError(409, "Booking must be completed before review", "BOOKING_NOT_COMPLETED");
  }

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .insert({
      booking_id: booking.id,
      client_id: req.user!.id,
      trainer_id: booking.trainer_id,
      rating: payload.rating,
      comment: payload.comment ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new HttpError(409, "Review already exists for this booking", "REVIEW_ALREADY_EXISTS");
    }
    throw new HttpError(400, error.message, "REVIEW_CREATE_FAILED");
  }

  res.status(201).json(data);
});

reviewsRouter.get("/trainers/:id/reviews", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("*")
    .eq("trainer_id", req.params.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(400, error.message, "REVIEWS_LIST_FAILED");
  }

  res.json(data);
});

reviewsRouter.delete("/reviews/:id", requireAuth, async (req, res) => {
  const { data: review, error: reviewError } = await supabaseAdmin
    .from("reviews")
    .select("id, client_id")
    .eq("id", req.params.id)
    .single();

  if (reviewError || !review) {
    throw new HttpError(404, "Review not found", "REVIEW_NOT_FOUND");
  }
  if (review.client_id !== req.user!.id) {
    throw new HttpError(403, "Can only delete your own review", "FORBIDDEN");
  }

  const { error } = await supabaseAdmin.from("reviews").delete().eq("id", req.params.id);
  if (error) {
    throw new HttpError(400, error.message, "REVIEW_DELETE_FAILED");
  }

  res.status(204).send();
});
