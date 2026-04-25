import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const fallbackUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const fallbackAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resolvedUrl = url || fallbackUrl;
const resolvedAnonKey = anonKey || fallbackAnonKey;

export const realtimeClient = resolvedUrl && resolvedAnonKey ? createClient(resolvedUrl, resolvedAnonKey) : null;
