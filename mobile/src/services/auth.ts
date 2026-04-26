import { apiRequest } from "../lib/api-client";
import type { AuthResponse, Role } from "../types/api";

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
