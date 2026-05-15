import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const TRAINER_USER = "b1111111-1111-4111-8111-111111111111";
const TRAINER_ID = "b2222222-2222-4222-8222-222222222222";
const CLIENT_TARGET = "b3333333-3333-4333-8333-333333333333";
const PLAN_ID = "b4444444-4444-4444-8444-444444444444";

describe("plans routes (CRUD, mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const planRow = {
      id: PLAN_ID,
      client_id: CLIENT_TARGET,
      trainer_id: TRAINER_ID,
      title: "Spring plan",
      plan_type: "fitness",
      content: { weeks: 1 },
    };
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
            select: (cols: string) => {
              const chain = {
                eq: (col: string, val: unknown) => {
                  if (col === "user_id" && val === TRAINER_USER) {
                    return {
                      maybeSingle: () => Promise.resolve({ data: { id: TRAINER_ID, verified: true }, error: null }),
                    };
                  }
                  if (col === "id") {
                    return {
                      single: () => Promise.resolve({ data: { id: TRAINER_ID, user_id: TRAINER_USER }, error: null }),
                    };
                  }
                  return { maybeSingle: () => Promise.resolve({ data: null, error: null }) };
                },
              };
              if (String(cols).includes("user_id") && String(cols).includes("verified")) {
                return {
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { id: TRAINER_ID, verified: true }, error: null }),
                  }),
                };
              }
              return chain;
            },
          };
        }
        if (table === "plans") {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { ...planRow }, error: null }),
              }),
            }),
            select: () => ({
              eq: (col: string, val: unknown) => {
                if (col === "id" && val === PLAN_ID) {
                  return {
                    single: () => Promise.resolve({ data: { ...planRow }, error: null }),
                  };
                }
                if (col === "trainer_id") {
                  return {
                    order: () => Promise.resolve({ data: [{ ...planRow }], error: null }),
                  };
                }
                if (col === "client_id") {
                  return {
                    order: () => Promise.resolve({ data: [{ ...planRow }], error: null }),
                  };
                }
                return { order: () => Promise.resolve({ data: [], error: null }) };
              },
              order: () =>
                Object.assign(Promise.resolve({ data: [{ ...planRow }], error: null }), {
                  eq: () => Promise.resolve({ data: [{ ...planRow }], error: null }),
                }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { ...planRow, title: "Updated title" },
                      error: null,
                    }),
                }),
              }),
            }),
            delete: () => ({
              eq: () => Promise.resolve({ error: null }),
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

  it("POST /plans creates a plan for a verified trainer", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .post("/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({
        clientId: CLIENT_TARGET,
        title: "Spring plan",
        planType: "fitness",
        content: { weeks: 1 },
      })
      .expect(201);
    expect(res.body).toMatchObject({ id: PLAN_ID, title: "Spring plan" });
  });

  it("GET /plans/:id returns plan when user has access", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app).get(`/plans/${PLAN_ID}`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toMatchObject({ id: PLAN_ID });
  });

  it("PUT /plans/:id updates a plan", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .put(`/plans/${PLAN_ID}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated title" })
      .expect(200);
    expect(res.body).toMatchObject({ title: "Updated title" });
  });

  it("DELETE /plans/:id removes a plan", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    await request(app).delete(`/plans/${PLAN_ID}`).set("Authorization", `Bearer ${token}`).expect(204);
  });
});
