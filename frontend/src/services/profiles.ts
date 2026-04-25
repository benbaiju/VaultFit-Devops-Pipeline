import { apiRequest } from "../lib/api-client";
import type { Profile } from "../types/api";

type UpdateProfileInput = {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  timezone?: string;
};

export async function getMyProfile(token: string): Promise<Profile> {
  return apiRequest<Profile>("/profiles/me", {}, token);
}

export async function updateMyProfile(token: string, input: UpdateProfileInput): Promise<Profile> {
  return apiRequest<Profile>(
    "/profiles/me",
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function sendPhoneOtp(token: string, phone: string): Promise<{ message: string; otpPreview?: string }> {
  return apiRequest<{ message: string; otpPreview?: string }>(
    "/profiles/me/phone/send-otp",
    {
      method: "POST",
      body: JSON.stringify({ phone }),
    },
    token,
  );
}

export async function verifyPhoneOtp(
  token: string,
  otp: string,
): Promise<{ message: string; verifiedAt: string; phone: string }> {
  return apiRequest<{ message: string; verifiedAt: string; phone: string }>(
    "/profiles/me/phone/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ otp }),
    },
    token,
  );
}
