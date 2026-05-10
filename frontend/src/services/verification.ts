import { apiRequest } from "../lib/api-client";
import type {
  AdminReviewTimelineResponse,
  AdminStats,
  AdminTrainer,
  AdminUser,
  VerificationRequest,
} from "../types/api";

export async function submitVerificationRequest(
  token: string,
  input: { credentialUrl: string; notes?: string },
): Promise<VerificationRequest> {
  return apiRequest<VerificationRequest>(
    "/verification-requests",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function submitVerificationDocument(
  token: string,
  input: {
    credentialFile?: File;
    identityFile?: File;
    credentialUrl?: string;
    identityUrl?: string;
    notes?: string;
  },
): Promise<VerificationRequest> {
  const form = new FormData();
  if (input.credentialFile) form.append("credentialDocument", input.credentialFile);
  if (input.identityFile) form.append("identityDocument", input.identityFile);
  if (input.credentialUrl) form.append("credentialUrl", input.credentialUrl);
  if (input.identityUrl) form.append("identityUrl", input.identityUrl);
  if (input.notes) form.append("notes", input.notes);
  return apiRequest<VerificationRequest>(
    "/verification-requests/upload",
    {
      method: "POST",
      body: form,
    },
    token,
  );
}

export async function getVerificationRequest(token: string, requestId: string): Promise<VerificationRequest> {
  return apiRequest<VerificationRequest>(`/verification-requests/${requestId}`, {}, token);
}

export async function getMyVerificationRequests(token: string): Promise<VerificationRequest[]> {
  return apiRequest<VerificationRequest[]>("/verification-requests/me", {}, token);
}

export async function getVerificationDocumentUrl(token: string, requestId: string): Promise<{ url: string; source: string }> {
  return apiRequest<{ url: string; source: string }>(`/verification-requests/${requestId}/document-url?type=credential`, {}, token);
}

export async function getVerificationDocumentUrlByType(
  token: string,
  requestId: string,
  type: "credential" | "identity",
): Promise<{ url: string; source: string }> {
  return apiRequest<{ url: string; source: string }>(`/verification-requests/${requestId}/document-url?type=${type}`, {}, token);
}

export async function getAdminVerificationRequests(token: string): Promise<VerificationRequest[]> {
  return apiRequest<VerificationRequest[]>("/admin/verification-requests", {}, token);
}

export async function reviewVerificationRequest(
  token: string,
  requestId: string,
  input: { status: "approved" | "rejected"; adminNotes?: string },
): Promise<VerificationRequest> {
  return apiRequest<VerificationRequest>(
    `/admin/verification-requests/${requestId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/admin/users", {}, token);
}

export async function getAdminStats(token: string): Promise<AdminStats> {
  return apiRequest<AdminStats>("/admin/stats", {}, token);
}

export async function getAdminReviewTimeline(token: string): Promise<AdminReviewTimelineResponse> {
  return apiRequest<AdminReviewTimelineResponse>("/admin/review-timeline", {}, token);
}

export async function getAdminTrainers(token: string): Promise<AdminTrainer[]> {
  return apiRequest<AdminTrainer[]>("/admin/trainers", {}, token);
}

export async function setUserAccess(token: string, userId: string, suspended: boolean): Promise<AdminUser> {
  return apiRequest<AdminUser>(
    `/admin/users/${userId}/access`,
    { method: "PATCH", body: JSON.stringify({ suspended }) },
    token,
  );
}

export async function setTrainerVerifiedState(token: string, trainerId: string, verified: boolean): Promise<AdminTrainer> {
  return apiRequest<AdminTrainer>(
    `/admin/trainers/${trainerId}/verified`,
    { method: "PATCH", body: JSON.stringify({ verified }) },
    token,
  );
}
