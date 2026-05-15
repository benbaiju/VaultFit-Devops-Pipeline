import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const CLIENT_ID = "c1111111-1111-4111-8111-111111111111";
const TRAINER_ID = "c2222222-2222-4222-8222-222222222222";
const SERVICE_ID = "c3333333-3333-4333-8333-333333333333";
const BOOKING_ID = "c4444444-4444-4444-8444-444444444444";

describe("bookings routes (create + status, mocked)", () => {
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
              return { in: () => Promise.resolve({ data: [{ id: CLIENT_ID, full_name: "Client" }], error: null }) };
            },
          };
        }
        if (table === "trainers") {
          return {
            select: () => ({
              eq: (col: string, val: unknown) => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            in: () => Promise.resolve({ data: [{ id: TRAINER_ID, profiles: { full_name: "Coach" } }], error: null }),
          };
        }
        if (table === "bookings") {
          return {
            select: (cols?: string) => ({
              order: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
                or: () => Promise.resolve({ data: [], error: null }),
              }),
              eq: (col: string, val: unknown) => {
                if (col === "id" && val === BOOKING_ID) {
                  return {
                    single: () =>
                      Promise.resolve({
                        data: {
                          id: BOOKING_ID,
                          client_id: CLIENT_ID,
                          trainer_id: TRAINER_ID,
                          status: "pending",
                        },
                        error: null,
                      }),
                  };
                }
                return { single: () => Promise.resolve({ data: null, error: null }) };
              },
            }),
            insert: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: BOOKING_ID,
                      client_id: CLIENT_ID,
                      trainer_id: TRAINER_ID,
                      service_id: SERVICE_ID,
                      status: "pending",
                      booking_date: "2026-06-01",
                      start_time: "10:00:00",
                      end_time: "11:00:00",
                    },
                    error: null,
                  }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: BOOKING_ID,
                        status: "confirmed",
                        client_id: CLIENT_ID,
                        trainer_id: TRAINER_ID,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "services") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: SERVICE_ID, trainer_id: TRAINER_ID, is_active: true },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "blocked_dates") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
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
                  eq: () =>
                    Promise.resolve({
                      data: [
                        { id: "slot-1", day_of_week: 0, start_time: "09:00:00", end_time: "18:00:00" },
                        { id: "slot-2", day_of_week: 1, start_time: "09:00:00", end_time: "18:00:00" },
                        { id: "slot-3", day_of_week: 2, start_time: "09:00:00", end_time: "18:00:00" },
                        { id: "slot-4", day_of_week: 3, start_time: "09:00:00", end_time: "18:00:00" },
                        { id: "slot-5", day_of_week: 4, start_time: "09:00:00", end_time: "18:00:00" },
                        { id: "slot-6", day_of_week: 5, start_time: "09:00:00", end_time: "18:00:00" },
                        { id: "slot-7", day_of_week: 6, start_time: "09:00:00", end_time: "18:00:00" },
                      ],
                      error: null,
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

  it("POST /bookings creates a booking when slot is available", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        trainerId: TRAINER_ID,
        serviceId: SERVICE_ID,
        bookingDate: "2026-06-01",
        startTime: "10:00:00",
        endTime: "11:00:00",
      })
      .expect(201);
    expect(res.body).toMatchObject({ id: BOOKING_ID, status: "pending" });
  });

  it("PATCH /bookings/:id/status updates as the booking client", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app)
      .patch(`/bookings/${BOOKING_ID}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "confirmed" })
      .expect(200);
    expect(res.body).toMatchObject({ status: "confirmed" });
  });
});
