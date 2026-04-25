function resolveApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Dev: hit Vite proxy → backend (avoids localhost/LAN mismatches and some IPv6 issues).
  if (import.meta.env.DEV) return "/api";
  return "http://127.0.0.1:4000";
}

const API_URL = resolveApiBase();

const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 25_000;

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const devHint =
        import.meta.env.DEV && API_URL === "/api"
          ? " In dev, requests go through Vite to 127.0.0.1:4000 (see vite.config proxy). If the API still times out, the backend may be stuck on Supabase—check backend .env and that PORT matches your proxy target."
          : ` Check VITE_API_URL (${API_URL}) and that the API process is listening.`;
      throw new ApiError(
        `API request timed out or was cancelled (${API_TIMEOUT_MS}ms).${devHint}`,
        0,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.message ?? "Request failed", response.status);
  }
  return data as T;
}
