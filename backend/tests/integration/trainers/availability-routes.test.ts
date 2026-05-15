import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const TRAINER_USER = "f1111111-1111-4111-8111-111111111111";
const TRAINER_ID = "f2222222-2222-4222-8222-222222222222";
const SERVICE_ID = "f3333333-3333-4333-8333-333333333333";
const SLOT_ID = "f4444444-4444-4444-8444-444444444444";

describe("availability routes (open slots + mutations, mocked)", () => {
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
                single: () =>
                  Promise.resolve({
                    data: { id: SERVICE_ID, duration_minutes: 60, is_active: true },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "trainer_availability") {
          return {
            select: (cols?: string) => {
              if (String(cols).includes("day_of_week") && String(cols).includes("start_time")) {
                return {
                  eq: () => ({
                    eq: () =>
                      Promise.resolve({
                        data: [{ day_of_week: 0, start_time: "09:00:00", end_time: "18:00:00" }],
                        error: null,
                      }),
                  }),
                };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      order: () =>
                        Promise.resolve({
                          data: [{ day_of_week: 0, start_time: "09:00:00", end_time: "18:00:00" }],
                          error: null,
                        }),
                    }),
                  }),
                }),
              };
            },
            insert: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: SLOT_ID,
                      trainer_id: TRAINER_ID,
                      service_id: SERVICE_ID,
                      day_of_week: 1,
                      start_time: "10:00:00",
                      end_time: "11:00:00",
                    },
                    error: null,
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
        if (table === "blocked_dates") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: [], error: null }),
                  gte: () => ({
                    lte: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: "bd-1",
                      trainer_id: TRAINER_ID,
                      service_id: SERVICE_ID,
                      blocked_date: "2026-07-01",
                      reason: "Vacation",
                    },
                    error: null,
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
        if (table === "bookings") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () => ({
                    lte: () => ({
                      in: () => Promise.resolve({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "trainers") {
          return {
            select: () => ({
              eq: (col: string, val: unknown) => ({
                single: () =>
                  col === "id" && val === TRAINER_ID
                    ? Promise.resolve({ data: { id: TRAINER_ID, user_id: TRAINER_USER }, error: null })
                    : Promise.resolve({ data: null, error: { message: "x" } }),
                maybeSingle: () =>
                  col === "user_id" && val === TRAINER_USER
                    ? Promise.resolve({ data: { id: TRAINER_ID, verified: true }, error: null })
                    : Promise.resolve({ data: null, error: null }),
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

  it("GET /trainers/:trainerId/open-slots returns computed slots", async () => {
    const res = await request(app)
      .get(`/trainers/${TRAINER_ID}/open-slots`)
      .query({ serviceId: SERVICE_ID, from: "2026-06-01", to: "2026-06-02" })
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /trainers/:trainerId/blocked-dates lists rows", async () => {
    const res = await request(app)
      .get(`/trainers/${TRAINER_ID}/blocked-dates`)
      .query({ serviceId: SERVICE_ID })
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /trainers/:trainerId/availability creates a slot", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .post(`/trainers/${TRAINER_ID}/availability`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        serviceId: SERVICE_ID,
        dayOfWeek: 1,
        startTime: "10:00:00",
        endTime: "11:00:00",
      })
      .expect(201);
    expect(res.body).toMatchObject({ id: SLOT_ID });
  });

  it("DELETE /trainers/:trainerId/availability/:slotId removes slot", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    await request(app)
      .delete(`/trainers/${TRAINER_ID}/availability/${SLOT_ID}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
  });

  it("POST /trainers/:trainerId/blocked-dates creates a blocked date", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .post(`/trainers/${TRAINER_ID}/blocked-dates`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        serviceId: SERVICE_ID,
        blockedDate: "2026-07-01",
        reason: "Vacation",
      })
      .expect(201);
    expect(res.body).toMatchObject({ blocked_date: "2026-07-01" });
  });

  it("DELETE /trainers/:trainerId/blocked-dates/:id removes blocked date", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    await request(app).delete(`/trainers/${TRAINER_ID}/blocked-dates/bd-1`).set("Authorization", `Bearer ${token}`).expect(204);
  });
});
