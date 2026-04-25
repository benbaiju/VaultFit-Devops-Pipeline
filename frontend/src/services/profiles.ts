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
