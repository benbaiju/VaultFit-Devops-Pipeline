import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRAINER_ROW = {
  id: "tr-11111111-1111-4111-8111-111111111111",
  user_id: "usr-11111111-1111-4111-8111-111111111111",
  verified: true,
  specialty: "Nutrition",
  profiles: { full_name: "Test Nutritionist", avatar_url: null, role: "nutritionist" },
};

function createTrainersListMock() {
  const supabaseAdmin = {
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: null as null },
        error: { message: "unused" },
      })),
    },
    from: jest.fn((table: string) => {
      if (table !== "trainers") {
        return {
          select: () => Promise.resolve({ data: null, error: null }),
        };
      }
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            order: () => Promise.resolve({ data: [TRAINER_ROW], error: null }),
            single: () => Promise.resolve({ data: TRAINER_ROW, error: null }),
          };
          return chain;
        },
      };
    }),
  } as unknown as SupabaseClient;

  const supabaseAnon = {
    from: jest.fn(() => ({
      select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
    })),
  } as unknown as SupabaseClient;

  return { supabaseAdmin, supabaseAnon };
}

describe("public trainer routes (Supabase mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const { supabaseAdmin, supabaseAnon } = createTrainersListMock();
    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({
      supabaseAdmin,
      supabaseAnon,
    }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("GET /trainers returns a list", async () => {
    const res = await request(app).get("/trainers").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: TRAINER_ROW.id, specialty: "Nutrition" });
  });

  it("GET /trainers/:id returns one trainer", async () => {
    const res = await request(app).get(`/trainers/${TRAINER_ROW.id}`).expect(200);
    expect(res.body).toMatchObject({ id: TRAINER_ROW.id, user_id: TRAINER_ROW.user_id });
  });
});
