import { Router } from "express";
import crypto from "node:crypto";
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
const sendPhoneOtpSchema = z.object({
  phone: z.string().min(8).max(25),
});
const verifyPhoneOtpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/),
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
    .select("id, full_name, phone")
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
      ...(payload.phone && payload.phone !== existing.phone
        ? {
            phone_verified: false,
            phone_verified_at: null,
            phone_verification_code_hash: null,
            phone_verification_expires_at: null,
            phone_verification_attempts: 0,
          }
        : {}),
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

profilesRouter.post("/me/phone/send-otp", requireAuth, async (req, res) => {
  const payload = sendPhoneOtpSchema.parse(req.body);
  const normalizedPhone = normalizePhone(payload.phone);
  if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
    throw new HttpError(400, "Phone must be in international format (e.g. +61400111222).", "PHONE_INVALID");
  }
  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from("profiles")
    .select("phone, phone_verified")
    .eq("id", req.user!.id)
    .single();
  if (existingProfileError || !existingProfile) {
    throw new HttpError(400, existingProfileError?.message ?? "Profile not found", "PROFILE_READ_FAILED");
  }
  const existingPhoneNormalized = normalizePhone(existingProfile.phone ?? "");
  if (existingProfile.phone_verified && existingPhoneNormalized && existingPhoneNormalized === normalizedPhone) {
    throw new HttpError(
      409,
      "This phone number is already verified. You only need to verify again if you change the number.",
      "PHONE_ALREADY_VERIFIED",
    );
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = hashOtp(req.user!.id, otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      phone: normalizedPhone,
      phone_verified: false,
      phone_verified_at: null,
      phone_verification_code_hash: codeHash,
      phone_verification_expires_at: expiresAt,
      phone_verification_attempts: 0,
    })
    .eq("id", req.user!.id)
    .select("id")
    .single();
  if (error || !data) {
    throw new HttpError(400, error?.message ?? "Failed to send OTP", "PHONE_OTP_SEND_FAILED");
  }

  // TODO: wire SMS provider. For local/dev use preview.
  res.json({
    message: "OTP sent",
    ...(process.env.NODE_ENV !== "production" ? { otpPreview: otp } : {}),
  });
});

profilesRouter.post("/me/phone/verify-otp", requireAuth, async (req, res) => {
  const payload = verifyPhoneOtpSchema.parse(req.body);
  const { data: profile, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("id, phone, phone_verified, phone_verification_code_hash, phone_verification_expires_at, phone_verification_attempts")
    .eq("id", req.user!.id)
    .single();
  if (readError || !profile) {
    throw new HttpError(400, readError?.message ?? "Profile not found", "PROFILE_READ_FAILED");
  }
  if (profile.phone_verified) {
    res.json({ message: "Phone already verified", phone: profile.phone, alreadyVerified: true });
    return;
  }
  if (!profile.phone_verification_code_hash || !profile.phone_verification_expires_at) {
    throw new HttpError(409, "No pending OTP. Send OTP first.", "PHONE_OTP_NOT_REQUESTED");
  }
  if ((profile.phone_verification_attempts ?? 0) >= 5) {
    throw new HttpError(429, "Too many OTP attempts. Request a new OTP.", "PHONE_OTP_TOO_MANY_ATTEMPTS");
  }
  if (new Date(profile.phone_verification_expires_at).getTime() < Date.now()) {
    throw new HttpError(409, "OTP expired. Request a new OTP.", "PHONE_OTP_EXPIRED");
  }
  const expectedHash = hashOtp(req.user!.id, payload.otp);
  if (expectedHash !== profile.phone_verification_code_hash) {
    await supabaseAdmin
      .from("profiles")
      .update({ phone_verification_attempts: (profile.phone_verification_attempts ?? 0) + 1 })
      .eq("id", req.user!.id);
    throw new HttpError(401, "Invalid OTP code.", "PHONE_OTP_INVALID");
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      phone_verified: true,
      phone_verified_at: nowIso,
      phone_verification_code_hash: null,
      phone_verification_expires_at: null,
      phone_verification_attempts: 0,
    })
    .eq("id", req.user!.id);
  if (error) {
    throw new HttpError(400, error.message, "PHONE_OTP_VERIFY_FAILED");
  }
  res.json({ message: "Phone verified", verifiedAt: nowIso, phone: profile.phone });
});

function hashOtp(userId: string, otp: string): string {
  return crypto.createHash("sha256").update(`${userId}:${otp}`).digest("hex");
}

function normalizePhone(input: string): string {
  return input.trim().replace(/[\s\-()]/g, "");
}
