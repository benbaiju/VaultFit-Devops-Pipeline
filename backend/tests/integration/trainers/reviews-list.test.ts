import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRAINER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("GET /trainers/:id/reviews", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const supabaseAdmin = {
      auth: { getUser: jest.fn() },
      from: jest.fn((table: string) => {
        if (table === "reviews") {
          return {
            select: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [{ id: "r1", trainer_id: TRAINER_ID, rating: 5 }], error: null }),
              }),
            }),
          };
        }
        return { select: () => Promise.resolve({ data: null, error: null }) };
      }),
    } as unknown as SupabaseClient;
    const supabaseAnon = { from: jest.fn() } as unknown as SupabaseClient;
    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({ supabaseAdmin, supabaseAnon }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("returns reviews for a trainer", async () => {
    const res = await request(app).get(`/trainers/${TRAINER_ID}/reviews`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: "r1", rating: 5 });
  });
});
