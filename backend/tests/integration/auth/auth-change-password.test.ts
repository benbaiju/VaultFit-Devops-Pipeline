import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const USER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("POST /auth/change-password", () => {
  let app: Express;
  const updateUserById = jest.fn(() => Promise.resolve({ error: null }));
  const signInWithPassword = jest.fn(() => Promise.resolve({ data: { user: { id: USER_ID } }, error: null }));

  beforeAll(async () => {
    jest.resetModules();
    const supabaseAdmin = {
      auth: {
        ...supabaseAuthUnused(),
        admin: { updateUserById },
      },
      from: jest.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: (cols: string) => {
              if (String(cols).includes("access_suspended")) {
                return {
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { access_suspended: false }, error: null }),
                  }),
                };
              }
              return { eq: () => ({ single: () => Promise.resolve({ data: { email: "x@test.dev" }, error: null }) }) };
            },
          };
        }
        return { select: () => Promise.resolve({ data: null, error: null }) };
      }),
    } as unknown as SupabaseClient;

    const supabaseAnon = {
      auth: { signInWithPassword },
      from: jest.fn(),
    } as unknown as SupabaseClient;

    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({ supabaseAdmin, supabaseAnon }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("updates password when current password verifies", async () => {
    const token = signUserToken({ sub: USER_ID, role: "client", email: "client@test.dev" });
    const res = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "oldpass123", newPassword: "newpass456" })
      .expect(200);
    expect(res.body).toMatchObject({ message: expect.stringMatching(/updated/i) });
    expect(signInWithPassword).toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, { password: "newpass456" });
  });

  it("rejects when new password equals current password", async () => {
    const token = signUserToken({ sub: USER_ID, role: "client" });
    const res = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "samepass12", newPassword: "samepass12" })
      .expect(400);
    expect(res.body).toMatchObject({ error: "PASSWORD_UNCHANGED" });
  });
});
