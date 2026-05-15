import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const TRAINER_USER_ID = "11111111-1111-4111-8111-111111111111";
const TRAINER_ROW_ID = "22222222-2222-4222-8222-222222222222";

describe("GET /verification-requests/me", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const supabaseAdmin = {
      auth: supabaseAuthUnused(),
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
              return { eq: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) };
            },
          };
        }
        if (table === "trainers") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: TRAINER_ROW_ID }, error: null }),
              }),
            }),
          };
        }
        if (table === "verification_requests") {
          return {
            select: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: [{ id: "vr-1", trainer_id: TRAINER_ROW_ID, status: "pending" }],
                    error: null,
                  }),
              }),
            }),
          };
        }
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }),
    } as unknown as SupabaseClient;
    const supabaseAnon = { from: jest.fn() } as unknown as SupabaseClient;
    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({ supabaseAdmin, supabaseAnon }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("returns verification requests for the trainer", async () => {
    const token = signUserToken({ sub: TRAINER_USER_ID, role: "trainer" });
    const res = await request(app).get("/verification-requests/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: "vr-1", status: "pending" });
  });
});
