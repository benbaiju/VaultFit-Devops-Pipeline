import { apiRequest } from "../lib/api-client";

export type VerificationRequest = {
  id: string;
  trainer_id: string;
  status: "pending" | "approved" | "rejected";
  credential_url: string;
  identity_url: string | null;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export async function getMyVerificationRequests(token: string): Promise<VerificationRequest[]> {
  return apiRequest<VerificationRequest[]>("/verification-requests/me", {}, token);
}

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
