import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const TRAINER_USER = "f1111111-1111-4111-8111-111111111111";
const TRAINER_ID = "f2222222-2222-4222-8222-222222222222";
const SERVICE_ID = "f3333333-3333-4333-8333-333333333333";

describe("services routes (mutations, mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const serviceRow = {
      id: SERVICE_ID,
      trainer_id: TRAINER_ID,
      title: "Session",
      service_type: "session",
      duration_minutes: 60,
      price: 99,
      is_active: true,
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
            select: () => ({
              eq: (col: string, val: unknown) => ({
                single: () =>
                  col === "id" && val === TRAINER_ID
                    ? Promise.resolve({ data: { id: TRAINER_ID, user_id: TRAINER_USER }, error: null })
                    : Promise.resolve({ data: null, error: { message: "nf" } }),
                maybeSingle: () =>
                  col === "user_id" && val === TRAINER_USER
                    ? Promise.resolve({ data: { id: TRAINER_ID, verified: true }, error: null })
                    : Promise.resolve({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === "services") {
          return {
            select: () => ({
              eq: (col: string, val: unknown) => ({
                eq: (c2: string, v2: unknown) => ({
                  maybeSingle: () =>
                    col === "id" && c2 === "trainer_id"
                      ? Promise.resolve({ data: { id: SERVICE_ID }, error: null })
                      : Promise.resolve({ data: null, error: null }),
                }),
                single: () => Promise.resolve({ data: { ...serviceRow }, error: null }),
                order: () => Promise.resolve({ data: [{ ...serviceRow }], error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { ...serviceRow }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { ...serviceRow, title: "Updated session" },
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
            delete: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ error: null }),
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

  it("POST /trainers/:trainerId/services creates a service", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .post(`/trainers/${TRAINER_ID}/services`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Session",
        serviceType: "session",
        durationMinutes: 60,
        price: 99,
      })
      .expect(201);
    expect(res.body).toMatchObject({ id: SERVICE_ID });
  });

  it("PUT /trainers/:trainerId/services/:serviceId updates", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .put(`/trainers/${TRAINER_ID}/services/${SERVICE_ID}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated session" })
      .expect(200);
    expect(res.body).toMatchObject({ title: "Updated session" });
  });

  it("DELETE /trainers/:trainerId/services/:serviceId removes", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    await request(app).delete(`/trainers/${TRAINER_ID}/services/${SERVICE_ID}`).set("Authorization", `Bearer ${token}`).expect(204);
  });
});
