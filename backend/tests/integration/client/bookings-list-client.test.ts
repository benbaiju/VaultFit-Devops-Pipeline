import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const CLIENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("GET /bookings (client)", () => {
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
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          const tail = {
            eq: () => Promise.resolve({ data: [], error: null }),
            or: () => Promise.resolve({ data: [], error: null }),
          };
          return {
            select: () => ({
              order: () => tail,
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

  it("returns an empty list for a client with no trainer profile", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app).get("/bookings").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toEqual([]);
  });
});
