import { apiRequest } from "../lib/api-client";
import type { Booking } from "../types/api";

type CreateBookingInput = {
  trainerId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
};

export async function getBookings(token: string): Promise<Booking[]> {
  return apiRequest<Booking[]>("/bookings", {}, token);
}

export async function createBooking(token: string, input: CreateBookingInput): Promise<Booking> {
  return apiRequest<Booking>(
    "/bookings",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function payBooking(token: string, bookingId: string, amount = 90): Promise<void> {
  await apiRequest(
    "/payments/initiate",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId,
        amount,
        currency: "AUD",
      }),
    },
    token,
  );
}
