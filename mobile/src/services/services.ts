import { apiRequest } from "../lib/api-client";
import type { Service } from "../types/api";

type CreateServiceInput = {
  title: string;
  serviceType: "session" | "program" | "consultation";
  durationMinutes: number;
  price: number;
  isActive?: boolean;
};

type UpdateServiceInput = Partial<CreateServiceInput>;

export async function getServices(trainerId: string): Promise<Service[]> {
  return apiRequest<Service[]>(`/trainers/${trainerId}/services`);
}

export async function createService(token: string, trainerId: string, input: CreateServiceInput): Promise<Service> {
  return apiRequest<Service>(
    `/trainers/${trainerId}/services`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function updateService(token: string, trainerId: string, serviceId: string, input: UpdateServiceInput): Promise<Service> {
  return apiRequest<Service>(
    `/trainers/${trainerId}/services/${serviceId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function deleteService(token: string, trainerId: string, serviceId: string): Promise<void> {
  await apiRequest(`/trainers/${trainerId}/services/${serviceId}`, { method: "DELETE" }, token);
}
