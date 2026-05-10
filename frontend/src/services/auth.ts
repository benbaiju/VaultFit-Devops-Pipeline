import { apiRequest } from "../lib/api-client";

export async function changePassword(
  token: string,
  input: { currentPassword: string; newPassword: string },
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    "/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}
