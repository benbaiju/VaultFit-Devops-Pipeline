import { supabaseAdmin, supabaseAnon } from "../lib/supabase.js";
import { HttpError } from "../middleware/error-handler.js";

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
    throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, full_name, access_suspended")
    .eq("id", sessionData.user.id)
    .single();

  if (profileError) {
    throw new HttpError(400, profileError.message, "LOGIN_FAILED");
  }

  if (profile && "access_suspended" in profile && profile.access_suspended === true) {
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

  return {
    message: "User registered",
    token: signInData.session.access_token,
    user: { id: userData.user.id, email: payload.email, role: payload.role },
  };
}
