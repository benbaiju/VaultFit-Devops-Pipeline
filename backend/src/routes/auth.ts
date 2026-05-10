import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin, supabaseAnon } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { withTimeout } from "../lib/with-timeout.js";
import { performLogin, performRegister } from "./auth-handlers.js";

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(["client", "trainer", "nutritionist", "admin"]).default("client"),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

/** Keep under typical browser/proxy client timeouts so the API returns JSON instead of hanging. */
const LOGIN_UPSTREAM_MS = Number(process.env.AUTH_LOGIN_TIMEOUT_MS ?? 22_000);
const REGISTER_UPSTREAM_MS = Number(process.env.AUTH_REGISTER_TIMEOUT_MS ?? 45_000);

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const body = await withTimeout(performRegister(payload), REGISTER_UPSTREAM_MS, "Registration (Supabase)");
  res.status(201).json(body);
});

authRouter.post("/login", async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const body = await withTimeout(performLogin(payload), LOGIN_UPSTREAM_MS, "Login (Supabase)");
  res.json(body);
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const payload = changePasswordSchema.parse(req.body);
  if (payload.newPassword === payload.currentPassword) {
    throw new HttpError(400, "New password must be different from your current password", "PASSWORD_UNCHANGED");
  }

  let resolvedEmail = req.user!.email?.trim();
  if (!resolvedEmail) {
    const { data: prof, error: profErr } = await supabaseAdmin.from("profiles").select("email").eq("id", req.user!.id).single();
    if (profErr || !prof?.email) {
      throw new HttpError(400, profErr?.message ?? "Could not resolve account email", "EMAIL_MISSING");
    }
    resolvedEmail = prof.email.trim();
  }
  if (!resolvedEmail) {
    throw new HttpError(400, "Could not resolve account email", "EMAIL_MISSING");
  }

  const { error: signErr } = await supabaseAnon.auth.signInWithPassword({
    email: resolvedEmail,
    password: payload.currentPassword,
  });
  if (signErr) {
    throw new HttpError(401, "Current password is incorrect", "INVALID_CURRENT_PASSWORD");
  }

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(req.user!.id, {
    password: payload.newPassword,
  });
  if (updateErr) {
    throw new HttpError(400, updateErr.message, "PASSWORD_UPDATE_FAILED");
  }

  res.json({ message: "Password updated successfully." });
});
