import { Router } from "express";
import { z } from "zod";
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
