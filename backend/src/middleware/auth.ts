import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AppRole } from "../types/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { HttpError } from "./error-handler.js";

/** True when Supabase Auth could not be reached (timeout, DNS, TLS) — not a bad JWT. */
function isAuthProviderNetworkFailure(err: unknown): boolean {
  if (err == null) return false;
  const chunks: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur != null; i++) {
    if (cur instanceof Error) {
      chunks.push(cur.message);
      const c = cur.cause;
      if (c && typeof c === "object" && "code" in c) {
        chunks.push(String((c as { code: unknown }).code));
      }
      cur = c;
      continue;
    }
    if (typeof cur === "object" && "message" in (cur as object)) {
      chunks.push(String((cur as { message: unknown }).message));
    }
    break;
  }
  const blob = chunks.join(" ").toLowerCase();
  return (
    blob.includes("fetch failed") ||
    blob.includes("connect timeout") ||
    blob.includes("und_err_connect_timeout") ||
    blob.includes("econnreset") ||
    blob.includes("etimedout")
  );
}

type JwtUserPayload = { id: string; email?: string; role?: AppRole };

/**
 * Validates the Supabase user JWT locally using the project's JWT secret (Dashboard → Settings → API → JWT Secret).
 * Avoids a round-trip to GoTrue `getUser`, which can block for ~10s when Supabase Auth is slow or unreachable.
 */
function tryVerifyUserJwtHs256(token: string, secret: string): JwtUserPayload | null {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload & { user_metadata?: { role?: string } };
    const id = decoded.sub;
    if (!id || typeof id !== "string") return null;
    return {
      id,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      role: decoded.user_metadata?.role as AppRole | undefined,
    };
  } catch {
    return null;
  }
}

async function ensureAccessNotSuspended(userId: string): Promise<void> {
  try {
    const { data: accessRow, error: accessError } = await supabaseAdmin
      .from("profiles")
      .select("access_suspended")
      .eq("id", userId)
      .maybeSingle();

    if (accessError) {
      if (accessError.message?.includes("access_suspended") || accessError.message?.includes("column")) {
        throw new HttpError(
          500,
          "Database is missing the access_suspended column. Apply backend/supabase/migrations/20260225000000_profiles_access_suspended.sql",
          "SCHEMA_OUTDATED",
        );
      }
      if (isAuthProviderNetworkFailure(accessError)) {
        throw new HttpError(
          503,
          "Database is temporarily unreachable (network timeout). Retry shortly; check VPN/firewall and Supabase status.",
          "AUTH_PROVIDER_UNAVAILABLE",
        );
      }
      throw new HttpError(500, accessError.message, "PROFILE_CHECK_FAILED");
    }

    if (accessRow?.access_suspended) {
      throw new HttpError(403, "Account access has been suspended", "ACCOUNT_SUSPENDED");
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (isAuthProviderNetworkFailure(e)) {
      throw new HttpError(
        503,
        "Database is temporarily unreachable (network timeout). Retry shortly; check VPN/firewall and Supabase status.",
        "AUTH_PROVIDER_UNAVAILABLE",
      );
    }
    throw e;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid Authorization header", "UNAUTHORIZED");
  }

  const token = authHeader.split(" ")[1];
  const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim();

  let resolved: JwtUserPayload | null = null;

  if (jwtSecret) {
    resolved = tryVerifyUserJwtHs256(token, jwtSecret);
  }

  if (!resolved) {
    let data: Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>["data"];
    let error: Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>["error"];

    try {
      const res = await supabaseAdmin.auth.getUser(token);
      data = res.data;
      error = res.error;
    } catch (e) {
      if (isAuthProviderNetworkFailure(e)) {
        throw new HttpError(
          503,
          "Authentication service is temporarily unreachable (network timeout). Retry shortly; check VPN/firewall and Supabase project status.",
          "AUTH_PROVIDER_UNAVAILABLE",
        );
      }
      throw e;
    }

    if (error) {
      if (isAuthProviderNetworkFailure(error)) {
        throw new HttpError(
          503,
          "Authentication service is temporarily unreachable (network timeout). Retry shortly; check VPN/firewall and Supabase project status.",
          "AUTH_PROVIDER_UNAVAILABLE",
        );
      }
      throw new HttpError(401, "Invalid or expired token", "UNAUTHORIZED");
    }

    if (!data.user) {
      throw new HttpError(401, "Invalid or expired token", "UNAUTHORIZED");
    }

    resolved = {
      id: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata?.role as AppRole | undefined,
    };
  }

  await ensureAccessNotSuspended(resolved.id);

  req.user = {
    id: resolved.id,
    email: resolved.email,
    role: resolved.role,
  };
  next();
}

export function requireRole(roles: AppRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError(401, "Authentication required", "UNAUTHORIZED");
    }
    if (!req.user.role || !roles.includes(req.user.role)) {
      throw new HttpError(403, "Insufficient permissions", "FORBIDDEN");
    }
    next();
  };
}

export async function ensureVerifiedTrainerUser(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("trainers")
    .select("id, verified")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new HttpError(403, "Create your trainer profile first", "TRAINER_PROFILE_MISSING");
  }
  if (!data.verified) {
    throw new HttpError(403, "Your profile is not verified yet", "TRAINER_NOT_VERIFIED");
  }
}
