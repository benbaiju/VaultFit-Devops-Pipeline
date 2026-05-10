import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { apiRequest, ApiError } from "../lib/api-client";
import { clearSession, getStoredToken, getStoredUser, saveSession } from "../lib/storage";
import type { AuthResponse, Role, User } from "../types/api";

type AuthContextValue = {
  token: string;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { fullName: string; email: string; password: string; role: Role }) => Promise<User>;
  logout: () => void;
  /** Merges into the signed-in user and persists session (e.g. after profile name update). */
  refreshUserDisplay: (updates: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseUser(value: string): User | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState<User | null>(parseUser(getStoredUser()));

  async function login(email: string, password: string): Promise<User> {
    const response = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!response.token || !response.user) {
      throw new ApiError("Login succeeded but the response was incomplete. Check the API /auth/login payload.", 500);
    }
    flushSync(() => {
      setToken(response.token);
      setUser(response.user);
    });
    saveSession(response.token, JSON.stringify(response.user));
    return response.user;
  }

  async function register(input: { fullName: string; email: string; password: string; role: Role }): Promise<User> {
    const response = await apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!response.token || !response.user) {
      throw new ApiError("Registration succeeded but the response was incomplete.", 500);
    }
    flushSync(() => {
      setToken(response.token);
      setUser(response.user);
    });
    saveSession(response.token, JSON.stringify(response.user));
    return response.user;
  }

  function logout(): void {
    setToken("");
    setUser(null);
    clearSession();
  }

  const refreshUserDisplay = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      saveSession(token, JSON.stringify(next));
      return next;
    });
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout,
      refreshUserDisplay,
    }),
    [token, user, refreshUserDisplay],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
