import dotenv from "dotenv";

dotenv.config();

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  /** Default binds all interfaces; use 127.0.0.1 to listen on loopback only. */
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  paymentsMode: (process.env.PAYMENTS_MODE ?? "mock") as "mock" | "stripe",
  verificationDocsBucket: process.env.VERIFICATION_DOCS_BUCKET ?? "credential-docs",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
};
