import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const CLIENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("GET /profiles/me", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const supabaseAdmin = {
      auth: supabaseAuthUnused(),
      from: jest.fn((table: string) => {
        if (table !== "profiles") {
          return { select: () => Promise.resolve({ data: null, error: null }) };
        }
        return {
          select: (cols: string) => {
            if (String(cols).includes("access_suspended")) {
              return {
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { access_suspended: false }, error: null }),
                }),
              };
            }
            return {
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: CLIENT_ID,
                      email: "client@test.dev",
                      role: "client",
                      full_name: "Client",
                    },
                    error: null,
                  }),
              }),
            };
          },
        };
      }),
    } as unknown as SupabaseClient;

    const supabaseAnon = { from: jest.fn() } as unknown as SupabaseClient;
    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({ supabaseAdmin, supabaseAnon }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("returns the profile row for the authenticated user", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app).get("/profiles/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toMatchObject({ id: CLIENT_ID, email: "client@test.dev", role: "client" });
  });
});
