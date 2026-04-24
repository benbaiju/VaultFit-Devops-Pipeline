import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const initiateSchema = z.object({
  bookingId: z.uuid(),
  amount: z.number().positive(),
  currency: z.string().default("AUD"),
});

export const paymentsRouter = Router();

paymentsRouter.post("/initiate", requireAuth, async (req, res) => {
  const payload = initiateSchema.parse(req.body);

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, client_id")
    .eq("id", payload.bookingId)
    .single();
  if (bookingError || !booking) throw new HttpError(404, "Booking not found", "BOOKING_NOT_FOUND");
  if (booking.client_id !== req.user!.id) throw new HttpError(403, "Only booking owner can pay", "FORBIDDEN");

  if (env.paymentsMode !== "mock") {
    throw new HttpError(400, "Stripe mode is not enabled yet", "PAYMENT_MODE_UNAVAILABLE");
  }

  const transactionRef = `mock_${Date.now()}`;
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .upsert(
      {
        booking_id: payload.bookingId,
        amount: payload.amount,
        currency: payload.currency,
        provider: "mock",
        status: "paid",
        transaction_ref: transactionRef,
      },
      { onConflict: "booking_id" },
    )
    .select("*")
    .single();

  if (paymentError) throw new HttpError(400, paymentError.message, "PAYMENT_INITIATE_FAILED");

  const { error: bookingUpdateError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", payload.bookingId);
  if (bookingUpdateError) throw new HttpError(400, bookingUpdateError.message, "BOOKING_CONFIRM_FAILED");

  res.status(201).json({
    message: "Mock payment captured",
    payment,
  });
});
