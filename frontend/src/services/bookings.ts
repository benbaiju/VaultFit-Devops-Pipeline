import { apiRequest } from "../lib/api-client";
import type { Booking, OpenSlot } from "../types/api";

type CreateBookingInput = {
  trainerId: string;
  serviceId: string;
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

export async function getOpenSlots(trainerId: string, serviceId: string, from: string, to: string): Promise<OpenSlot[]> {
  const params = new URLSearchParams({ serviceId, from, to });
  return apiRequest<OpenSlot[]>(`/trainers/${trainerId}/open-slots?${params.toString()}`);
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

export async function updateBookingStatus(
  token: string,
  bookingId: string,
  status: Booking["status"],
): Promise<Booking> {
  return apiRequest<Booking>(
    `/bookings/${bookingId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
    token,
  );
}
