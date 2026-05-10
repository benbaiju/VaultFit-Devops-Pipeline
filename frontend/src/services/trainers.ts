import { apiRequest } from "../lib/api-client";
import type { Trainer } from "../types/api";

export async function getTrainers(): Promise<Trainer[]> {
  return apiRequest<Trainer[]>("/trainers");
}

export async function getTrainerById(trainerId: string): Promise<Trainer> {
  return apiRequest<Trainer>(`/trainers/${trainerId}`);
}

export async function getMyTrainerProfile(token: string): Promise<Trainer | null> {
  return apiRequest<Trainer | null>("/trainers/me/profile", {}, token);
}

export async function createMyTrainerProfile(
  token: string,
  input: { bio?: string; specialty?: string; experienceYears?: number; hourlyRate?: number; expertiseTags?: string[] },
): Promise<Trainer> {
  return apiRequest<Trainer>(
    "/trainers",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function updateMyTrainerProfile(
  token: string,
  trainerId: string,
  input: { bio?: string; specialty?: string; experienceYears?: number; hourlyRate?: number; expertiseTags?: string[] },
): Promise<Trainer> {
  return apiRequest<Trainer>(
    `/trainers/${trainerId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    token,
  );
}
