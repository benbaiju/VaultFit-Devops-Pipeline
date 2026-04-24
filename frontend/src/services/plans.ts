import { apiRequest } from "../lib/api-client";
import type { Plan } from "../types/api";

type CreatePlanInput = {
  clientId: string;
  title: string;
  planType: "fitness" | "nutrition" | "hybrid";
  content: unknown;
};

type UpdatePlanInput = {
  title?: string;
  planType?: "fitness" | "nutrition" | "hybrid";
  content?: unknown;
};

export async function getPlans(token: string): Promise<Plan[]> {
  return apiRequest<Plan[]>("/plans", {}, token);
}

export async function createPlan(token: string, input: CreatePlanInput): Promise<Plan> {
  return apiRequest<Plan>(
    "/plans",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function updatePlan(token: string, planId: string, input: UpdatePlanInput): Promise<Plan> {
  return apiRequest<Plan>(
    `/plans/${planId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function deletePlan(token: string, planId: string): Promise<void> {
  await apiRequest(`/plans/${planId}`, { method: "DELETE" }, token);
}
