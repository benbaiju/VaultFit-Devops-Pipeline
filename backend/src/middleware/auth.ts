import type { NextFunction, Request, Response } from "express";
import type { AppRole } from "../types/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { HttpError } from "./error-handler.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid Authorization header", "UNAUTHORIZED");
  }

  const token = authHeader.split(" ")[1];
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired token", "UNAUTHORIZED");
  }

  const { data: accessRow, error: accessError } = await supabaseAdmin
    .from("profiles")
    .select("access_suspended")
    .eq("id", data.user.id)
    .maybeSingle();

  if (accessError) {
    if (accessError.message?.includes("access_suspended") || accessError.message?.includes("column")) {
      throw new HttpError(
        500,
        "Database is missing the access_suspended column. Apply backend/supabase/migrations/20260225000000_profiles_access_suspended.sql",
        "SCHEMA_OUTDATED",
      );
    }
    throw new HttpError(500, accessError.message, "PROFILE_CHECK_FAILED");
  }

  if (accessRow?.access_suspended) {
    throw new HttpError(403, "Account access has been suspended", "ACCOUNT_SUSPENDED");
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
    role: data.user.user_metadata?.role as AppRole | undefined,
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
