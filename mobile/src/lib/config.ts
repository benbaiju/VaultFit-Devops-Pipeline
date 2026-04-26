const rawApiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export const API_URL = rawApiUrl.replace(/\/$/, "");
