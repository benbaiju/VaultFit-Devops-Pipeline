import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin, supabaseAnon } from "../lib/supabase.js";
import { HttpError } from "../middleware/error-handler.js";

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(["client", "trainer", "admin"]).default("client"),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const payload = registerSchema.parse(req.body);

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", payload.email)
    .maybeSingle();

  if (existing) {
    throw new HttpError(409, "Email already registered", "EMAIL_EXISTS");
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      role: payload.role,
    },
  });

  if (userError || !userData.user) {
    throw new HttpError(400, userError?.message ?? "Unable to create auth user", "REGISTER_FAILED");
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: userData.user.id,
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone ?? null,
    role: payload.role,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    throw new HttpError(400, profileError.message, "PROFILE_CREATE_FAILED");
  }

  const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });
  if (signInError || !signInData.session) {
    throw new HttpError(400, signInError?.message ?? "Unable to create session", "REGISTER_FAILED");
  }

  res.status(201).json({
    message: "User registered",
    token: signInData.session.access_token,
    user: { id: userData.user.id, email: payload.email, role: payload.role },
  });
});

authRouter.post("/login", async (req, res) => {
  const payload = loginSchema.parse(req.body);

  const { data: sessionData, error: sessionError } = await supabaseAnon.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (sessionError || !sessionData.session || !sessionData.user) {
    throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, full_name")
    .eq("id", sessionData.user.id)
    .single();

  if (profileError) {
    throw new HttpError(400, profileError.message, "LOGIN_FAILED");
  }

  res.json({
    message: "Login successful",
    token: sessionData.session.access_token,
    user: profile,
  });
});
