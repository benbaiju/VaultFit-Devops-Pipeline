import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRAINER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SERVICE_ID = "33333333-3333-4333-8333-333333333333";

describe("GET /trainers/:trainerId/availability", () => {
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
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: SERVICE_ID }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "trainer_availability") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    order: () =>
                      Promise.resolve({
                        data: [
                          {
                            id: "av-1",
                            trainer_id: TRAINER_ID,
                            service_id: SERVICE_ID,
                            day_of_week: 1,
                            start_time: "09:00",
                            end_time: "17:00",
                          },
                        ],
                        error: null,
                      }),
                  }),
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

  it("returns availability rows when serviceId is provided", async () => {
    const res = await request(app)
      .get(`/trainers/${TRAINER_ID}/availability`)
      .query({ serviceId: SERVICE_ID })
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ day_of_week: 1, start_time: "09:00" });
  });
});
