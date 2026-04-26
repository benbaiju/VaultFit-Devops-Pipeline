import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "../types/api";

const TOKEN_KEY = "vaultfit_mobile_token";
const USER_KEY = "vaultfit_mobile_user";

export async function readSession(): Promise<{ token: string; user: User } | null> {
  const [token, userRaw] = await Promise.all([AsyncStorage.getItem(TOKEN_KEY), AsyncStorage.getItem(USER_KEY)]);
  if (!token || !userRaw) return null;
  try {
    return { token, user: JSON.parse(userRaw) as User };
  } catch {
    return null;
  }
}

export async function writeSession(token: string, user: User): Promise<void> {
  await Promise.all([AsyncStorage.setItem(TOKEN_KEY, token), AsyncStorage.setItem(USER_KEY, JSON.stringify(user))]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(TOKEN_KEY), AsyncStorage.removeItem(USER_KEY)]);
}
