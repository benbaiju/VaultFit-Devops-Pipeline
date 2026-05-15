import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const CLIENT_ID = "a1111111-1111-4111-8111-111111111111";

describe("profiles routes (mutations, mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const supabaseAdmin = {
      auth: supabaseAuthUnused(),
      from: jest.fn((table: string) => {
        if (table !== "profiles") return { select: () => Promise.resolve({ data: [], error: null }) };
        return {
          select: (cols: string) => {
            if (String(cols).includes("access_suspended")) {
              return {
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { access_suspended: false }, error: null }),
                }),
              };
            }
            if (cols === "*" || String(cols).includes("full_name")) {
              return {
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: CLIENT_ID,
                        full_name: "Pat Client",
                        phone: "+15550001111",
                        phone_verified: false,
                        avatar_url: null,
                        timezone: null,
                        role: "client",
                      },
                      error: null,
                    }),
                }),
              };
            }
            if (String(cols).includes("phone_verification_code_hash")) {
              return {
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: CLIENT_ID,
                        phone: "+15550001111",
                        phone_verified: true,
                        phone_verification_code_hash: null,
                        phone_verification_expires_at: null,
                        phone_verification_attempts: 0,
                      },
                      error: null,
                    }),
                }),
              };
            }
            if (String(cols).includes("phone_verified")) {
              return {
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { phone: "+15550001111", phone_verified: false },
                      error: null,
                    }),
                }),
              };
            }
            return { eq: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) };
          },
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: CLIENT_ID }, error: null }),
              }),
            }),
          }),
        };
      }),
    } as unknown as SupabaseClient;
    const supabaseAnon = { from: jest.fn() } as unknown as SupabaseClient;
    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({ supabaseAdmin, supabaseAnon }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("PUT /profiles/me with empty body returns current profile", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app).put("/profiles/me").set("Authorization", `Bearer ${token}`).send({}).expect(200);
    expect(res.body).toMatchObject({ id: CLIENT_ID, full_name: "Pat Client" });
  });

  it("POST /profiles/me/phone/send-otp accepts international phone", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app)
      .post("/profiles/me/phone/send-otp")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "+61400111222" })
      .expect(200);
    expect(res.body).toMatchObject({ message: expect.stringMatching(/otp sent/i) });
  });

  it("POST /profiles/me/phone/verify-otp returns already verified when applicable", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app)
      .post("/profiles/me/phone/verify-otp")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: "123456" })
      .expect(200);
    expect(res.body).toMatchObject({ alreadyVerified: true });
  });
});
