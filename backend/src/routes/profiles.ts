import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.url().optional(),
  timezone: z.string().optional(),
});

export const profilesRouter = Router();

profilesRouter.get("/me", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from("profiles").select("*").eq("id", req.user!.id).single();
  if (error) {
    throw new HttpError(400, error.message, "PROFILE_READ_FAILED");
  }
  res.json(data);
});

profilesRouter.put("/me", requireAuth, async (req, res) => {
  const payload = updateProfileSchema.parse(req.body);
  const { data: existing, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .eq("id", req.user!.id)
    .single();
  if (readError || !existing) {
    throw new HttpError(400, readError?.message ?? "Profile not found", "PROFILE_READ_FAILED");
  }

  // Clients can set their name once, but cannot change it later.
  if (
    req.user!.role === "client" &&
    existing.full_name &&
    payload.fullName &&
    payload.fullName.trim() !== existing.full_name
  ) {
    throw new HttpError(409, "Client name cannot be changed once set", "PROFILE_NAME_LOCKED");
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: payload.fullName,
      phone: payload.phone,
      avatar_url: payload.avatarUrl,
      timezone: payload.timezone,
    })
    .eq("id", req.user!.id)
    .select("*")
    .single();

  if (error) {
    throw new HttpError(400, error.message, "PROFILE_UPDATE_FAILED");
  }
  res.json(data);
});
