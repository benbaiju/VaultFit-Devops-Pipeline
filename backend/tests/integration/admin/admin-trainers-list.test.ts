import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("GET /admin/trainers", () => {
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
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "tr-1",
                      user_id: "u-1",
                      verified: true,
                      specialty: "Fitness",
                      profiles: { email: "t@test.dev", full_name: "Trainer", role: "trainer" },
                    },
                  ],
                  error: null,
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

  it("returns trainer rows for an admin", async () => {
    const token = signUserToken({ sub: ADMIN_ID, role: "admin" });
    const res = await request(app).get("/admin/trainers").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: "tr-1", specialty: "Fitness" });
  });
});
