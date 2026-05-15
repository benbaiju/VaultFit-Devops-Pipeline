import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const CLIENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BOOKING_ID = "f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0";

describe("POST /payments/initiate (mock mode)", () => {
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
        if (table === "bookings") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: BOOKING_ID, client_id: CLIENT_ID }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        if (table === "payments") {
          return {
            upsert: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: "pay-1",
                      booking_id: BOOKING_ID,
                      amount: 25,
                      currency: "AUD",
                      provider: "mock",
                      status: "paid",
                    },
                    error: null,
                  }),
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

  it("creates a mock payment when booking belongs to caller", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app)
      .post("/payments/initiate")
      .set("Authorization", `Bearer ${token}`)
      .send({ bookingId: BOOKING_ID, amount: 25, currency: "AUD" })
      .expect(201);
    expect(res.body).toMatchObject({ message: "Mock payment captured" });
    expect(res.body.payment).toMatchObject({ booking_id: BOOKING_ID, status: "paid" });
  });
});
