import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearSession, readSession, writeSession } from "../lib/storage";
import { login as loginApi, register as registerApi } from "../services/auth";
import type { Role, User } from "../types/api";

type AuthContextValue = {
  token: string;
  user: User | null;
  isReady: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { fullName: string; email: string; password: string; role: Role; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const session = await readSession();
      if (session) {
        setToken(session.token);
        setUser(session.user);
      }
      setIsReady(true);
    })();
  }, []);

  async function login(email: string, password: string) {
    const result = await loginApi(email, password);
    setToken(result.token);
    setUser(result.user);
    await writeSession(result.token, result.user);
  }

  async function register(input: { fullName: string; email: string; password: string; role: Role; phone?: string }) {
    const result = await registerApi(input);
    setToken(result.token);
    setUser(result.user);
    await writeSession(result.token, result.user);
  }

  async function logout() {
    setToken("");
    setUser(null);
    await clearSession();
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isReady,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
    }),
    [isReady, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
