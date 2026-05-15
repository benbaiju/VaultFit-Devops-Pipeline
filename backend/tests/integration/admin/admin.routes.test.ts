import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { createAdminStatsSupabaseMocks } from "../../shared/supabase-mock.js";

describe("admin routes", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const { supabaseAdmin, supabaseAnon } = createAdminStatsSupabaseMocks();
    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({
      supabaseAdmin,
      supabaseAnon,
    }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("GET /admin/stats returns counts when caller is admin (Supabase mocked)", async () => {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      throw new Error("SUPABASE_JWT_SECRET must be set for this test (see tests/setup-env.ts)");
    }
    const token = jwt.sign(
      { sub: "11111111-1111-1111-1111-111111111111", user_metadata: { role: "admin" } },
      secret,
      { algorithm: "HS256", expiresIn: "1h" },
    );

    const res = await request(app).get("/admin/stats").set("Authorization", `Bearer ${token}`).expect(200);

    expect(res.body).toEqual({
      total_users: 11,
      active_trainers_nutritionists: 4,
      total_bookings: 9,
      open_support_tickets: 2,
    });
  });

  it("returns 403 when JWT user is not admin (Supabase mocked)", async () => {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      throw new Error("SUPABASE_JWT_SECRET must be set for this test (see tests/setup-env.ts)");
    }
    const token = jwt.sign(
      { sub: "22222222-2222-2222-2222-222222222222", user_metadata: { role: "trainer" } },
      secret,
      { algorithm: "HS256", expiresIn: "1h" },
    );

    const res = await request(app).get("/admin/stats").set("Authorization", `Bearer ${token}`).expect(403);
    expect(res.body).toMatchObject({ error: "FORBIDDEN" });
  });
});
