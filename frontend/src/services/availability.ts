import { apiRequest } from "../lib/api-client";
import type { AvailabilitySlot, BlockedDate } from "../types/api";

type CreateAvailabilityInput = {
  serviceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type CreateBlockedDateInput = {
  serviceId: string;
  blockedDate: string;
  reason?: string;
};

export async function getAvailability(trainerId: string, serviceId: string): Promise<AvailabilitySlot[]> {
  const params = new URLSearchParams({ serviceId });
  return apiRequest<AvailabilitySlot[]>(`/trainers/${trainerId}/availability?${params.toString()}`);
}

export async function createAvailability(
  token: string,
  trainerId: string,
  input: CreateAvailabilityInput,
): Promise<AvailabilitySlot> {
  return apiRequest<AvailabilitySlot>(
    `/trainers/${trainerId}/availability`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function deleteAvailability(token: string, trainerId: string, slotId: string): Promise<void> {
  await apiRequest(`/trainers/${trainerId}/availability/${slotId}`, { method: "DELETE" }, token);
}

export async function getBlockedDates(trainerId: string, serviceId: string): Promise<BlockedDate[]> {
  const params = new URLSearchParams({ serviceId });
  return apiRequest<BlockedDate[]>(`/trainers/${trainerId}/blocked-dates?${params.toString()}`);
}

export async function createBlockedDate(
  token: string,
  trainerId: string,
  input: CreateBlockedDateInput,
): Promise<BlockedDate> {
  return apiRequest<BlockedDate>(
    `/trainers/${trainerId}/blocked-dates`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function deleteBlockedDate(token: string, trainerId: string, blockedDateId: string): Promise<void> {
  await apiRequest(`/trainers/${trainerId}/blocked-dates/${blockedDateId}`, { method: "DELETE" }, token);
}
