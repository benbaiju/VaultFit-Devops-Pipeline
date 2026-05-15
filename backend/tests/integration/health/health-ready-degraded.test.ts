import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("GET /health/ready (degraded)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const supabaseAnon = {
      from: () => ({
        select: () => ({
          limit: () => Promise.resolve({ error: { message: "connection refused" } }),
        }),
      }),
    } as unknown as SupabaseClient;
    const supabaseAdmin = { auth: { getUser: jest.fn() }, from: jest.fn() } as unknown as SupabaseClient;
    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({ supabaseAnon, supabaseAdmin }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("returns 503 when Supabase reports an error", async () => {
    const res = await request(app).get("/health/ready").expect(503);
    expect(res.body).toMatchObject({ status: "degraded", db: "down", message: "connection refused" });
  });
});
