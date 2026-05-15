import jwt from "jsonwebtoken";

export function signUserToken(input: { sub: string; role: string; email?: string }): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET is required (see tests/setup-env.ts)");
  return jwt.sign(
    {
      sub: input.sub,
      email: input.email ?? "user@test.dev",
      user_metadata: { role: input.role },
    },
    secret,
    { algorithm: "HS256", expiresIn: "1h" },
  );
}
