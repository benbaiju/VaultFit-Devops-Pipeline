import { supabaseAdmin, supabaseAnon } from "../lib/supabase.js";
import { createModuleLogger } from "../lib/logger.js";
import { HttpError } from "../middleware/error-handler.js";

const log = createModuleLogger("service", "auth-handlers");

type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  role: "client" | "trainer" | "nutritionist" | "admin";
  phone?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

export async function performLogin(payload: LoginPayload) {
  const { data: sessionData, error: sessionError } = await supabaseAnon.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (sessionError || !sessionData.session || !sessionData.user) {
    log.warn({ event: "login_invalid_credentials" }, "Login rejected: invalid credentials");
    throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, full_name, access_suspended")
    .eq("id", sessionData.user.id)
    .single();

  if (profileError) {
    log.warn({ event: "login_profile_fetch_failed", code: "LOGIN_FAILED" }, profileError.message);
    throw new HttpError(400, profileError.message, "LOGIN_FAILED");
  }

  if (profile && "access_suspended" in profile && profile.access_suspended === true) {
    log.warn({ event: "login_account_suspended" }, "Login blocked: account suspended");
    throw new HttpError(403, "Account access has been suspended. Contact support if you believe this is a mistake.", "ACCOUNT_SUSPENDED");
  }

  // Strip internal flag from API response
  const { access_suspended: _s, ...userPayload } = profile as typeof profile & { access_suspended?: boolean };
  return {
    message: "Login successful",
    token: sessionData.session.access_token,
    user: userPayload,
  };
}

export async function performRegister(payload: RegisterPayload) {
  const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", payload.email).maybeSingle();

  if (existing) {
    log.warn({ event: "register_email_exists" }, "Registration rejected: email already registered");
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
    log.warn(
      { event: "register_auth_user_failed", code: "REGISTER_FAILED" },
      userError?.message ?? "Unable to create auth user",
    );
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
    log.warn({ event: "register_profile_create_failed", code: "PROFILE_CREATE_FAILED" }, profileError.message);
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    throw new HttpError(400, profileError.message, "PROFILE_CREATE_FAILED");
  }

  const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });
  if (signInError || !signInData.session) {
    log.warn(
      { event: "register_session_failed", code: "REGISTER_FAILED" },
      signInError?.message ?? "Unable to create session",
    );
    throw new HttpError(400, signInError?.message ?? "Unable to create session", "REGISTER_FAILED");
  }

  return {
    message: "User registered",
    token: signInData.session.access_token,
    user: { id: userData.user.id, email: payload.email, role: payload.role },
  };
}
