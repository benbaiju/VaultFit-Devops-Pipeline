import { apiRequest } from "../lib/api-client";
import type { Trainer } from "../types/api";

export async function getTrainers(): Promise<Trainer[]> {
  return apiRequest<Trainer[]>("/trainers");
}
