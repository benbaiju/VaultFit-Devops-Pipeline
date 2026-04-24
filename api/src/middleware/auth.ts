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
