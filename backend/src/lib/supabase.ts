import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { createModuleLogger } from "./logger.js";

const log = createModuleLogger("lib", "supabase");

export const supabaseAnon = createClient(env.supabaseUrl, env.supabaseAnonKey);
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

log.debug("Supabase anon and service-role clients initialized");
