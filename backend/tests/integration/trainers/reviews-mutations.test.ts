import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const CLIENT_ID = "d1111111-1111-4111-8111-111111111111";
const BOOKING_ID = "d2222222-2222-4222-8222-222222222222";
const TRAINER_ID = "d3333333-3333-4333-8333-333333333333";
const REVIEW_ID = "d4444444-4444-4444-8444-444444444444";

describe("reviews routes (POST + DELETE, mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const completedBooking = {
      id: BOOKING_ID,
      client_id: CLIENT_ID,
      trainer_id: TRAINER_ID,
      status: "completed",
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
        if (table === "bookings") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: completedBooking, error: null }),
              }),
            }),
          };
        }
        if (table === "reviews") {
          return {
            insert: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: REVIEW_ID,
                      booking_id: BOOKING_ID,
                      rating: 5,
                      comment: "Great",
                    },
                    error: null,
                  }),
              }),
            }),
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: REVIEW_ID, client_id: CLIENT_ID },
                    error: null,
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

  it("POST /bookings/:id/review creates a review", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app)
      .post(`/bookings/${BOOKING_ID}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ rating: 5, comment: "Great" })
      .expect(201);
    expect(res.body).toMatchObject({ id: REVIEW_ID, rating: 5 });
  });

  it("DELETE /reviews/:id removes own review", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    await request(app).delete(`/reviews/${REVIEW_ID}`).set("Authorization", `Bearer ${token}`).expect(204);
  });
});
