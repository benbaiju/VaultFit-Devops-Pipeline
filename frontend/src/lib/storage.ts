const TOKEN_KEY = "vaultfit_token";
const USER_KEY = "vaultfit_user";

export function saveSession(token: string, user: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, user);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function getStoredUser(): string {
  return localStorage.getItem(USER_KEY) ?? "";
}
