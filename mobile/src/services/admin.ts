import { apiRequest } from "../lib/api-client";
import type { AdminReviewTimelineResponse, AdminTrainer, AdminUser } from "../types/api";

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/admin/users", {}, token);
}

export async function getAdminTrainers(token: string): Promise<AdminTrainer[]> {
  return apiRequest<AdminTrainer[]>("/admin/trainers", {}, token);
}

export async function setUserAccess(token: string, userId: string, suspended: boolean): Promise<AdminUser> {
  return apiRequest<AdminUser>(
    `/admin/users/${userId}/access`,
    {
      method: "PATCH",
      body: JSON.stringify({ suspended }),
    },
    token,
  );
}

export async function setTrainerVerifiedState(token: string, trainerId: string, verified: boolean): Promise<AdminTrainer> {
  return apiRequest<AdminTrainer>(
    `/admin/trainers/${trainerId}/verified`,
    {
      method: "PATCH",
      body: JSON.stringify({ verified }),
    },
    token,
  );
}

export async function getAdminReviewTimeline(token: string): Promise<AdminReviewTimelineResponse> {
  return apiRequest<AdminReviewTimelineResponse>("/admin/review-timeline", {}, token);
}
