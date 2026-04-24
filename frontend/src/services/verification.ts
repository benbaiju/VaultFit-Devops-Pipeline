import { apiRequest } from "../lib/api-client";
import type { AdminUser, VerificationRequest } from "../types/api";

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

export async function getVerificationRequest(token: string, requestId: string): Promise<VerificationRequest> {
  return apiRequest<VerificationRequest>(`/verification-requests/${requestId}`, {}, token);
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
