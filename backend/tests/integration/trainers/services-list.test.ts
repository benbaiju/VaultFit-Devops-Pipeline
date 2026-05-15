import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRAINER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("GET /trainers/:trainerId/services", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const supabaseAdmin = {
      auth: { getUser: jest.fn() },
      from: jest.fn((table: string) => {
        if (table === "services") {
          return {
            select: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: [{ id: "svc-1", trainer_id: TRAINER_ID, title: "Consult", is_active: true }],
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

  it("returns services for a trainer", async () => {
    const res = await request(app).get(`/trainers/${TRAINER_ID}/services`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ title: "Consult", trainer_id: TRAINER_ID });
  });
});
