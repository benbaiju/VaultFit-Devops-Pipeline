import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const TRAINER_USER = "e1111111-1111-4111-8111-111111111111";
const TRAINER_ID = "e2222222-2222-4222-8222-222222222222";

describe("trainers routes (me + create + update, mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const row = {
      id: TRAINER_ID,
      user_id: TRAINER_USER,
      bio: "Bio",
      specialty: "Strength",
      verified: true,
      hourly_rate: 50,
      expertise_tags: [],
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
            select: (cols?: string) => ({
              eq: (col: string, val: unknown) => {
                if (col === "user_id" && val === TRAINER_USER) {
                  return {
                    maybeSingle: () => Promise.resolve({ data: { ...row, profiles: { full_name: "Eve" } }, error: null }),
                  };
                }
                if (col === "id" && val === TRAINER_ID) {
                  return {
                    single: () => Promise.resolve({ data: { id: TRAINER_ID, user_id: TRAINER_USER }, error: null }),
                  };
                }
                return { maybeSingle: () => Promise.resolve({ data: null, error: null }) };
              },
              order: () => Promise.resolve({ data: [], error: null }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { ...row, id: TRAINER_ID }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: { ...row, bio: "Updated bio" }, error: null }),
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

  it("GET /trainers/me/profile returns trainer row", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app).get("/trainers/me/profile").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toMatchObject({ id: TRAINER_ID, user_id: TRAINER_USER });
  });

  it("POST /trainers creates profile", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .post("/trainers")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "Bio", specialty: "Strength", hourlyRate: 50 })
      .expect(201);
    expect(res.body).toMatchObject({ id: TRAINER_ID });
  });

  it("PUT /trainers/:id updates profile", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .put(`/trainers/${TRAINER_ID}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "Updated bio" })
      .expect(200);
    expect(res.body).toMatchObject({ bio: "Updated bio" });
  });
});
