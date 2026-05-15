import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const ADMIN_ID = "g1111111-1111-4111-8111-111111111111";
const TARGET_USER = "g2222222-2222-4222-8222-222222222222";

describe("admin routes (timeline + user access, mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const supabaseAdmin = {
      auth: supabaseAuthUnused(),
      from: jest.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: (cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.head) {
                return Promise.resolve({ count: 1, error: null });
              }
              if (String(cols).includes("access_suspended")) {
                return {
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { access_suspended: false }, error: null }),
                  }),
                };
              }
              if (String(cols).includes("id") && String(cols).includes("role") && !String(cols).includes("access_suspended")) {
                return {
                  eq: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { id: TARGET_USER, role: "client" },
                        error: null,
                      }),
                  }),
                };
              }
              return {
                in: () => Promise.resolve({ data: [{ id: ADMIN_ID, email: "a@a.com", full_name: "Admin" }], error: null }),
                order: () => Promise.resolve({ data: [{ id: TARGET_USER, email: "t@t.com", role: "client" }], error: null }),
              };
            },
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: TARGET_USER,
                        email: "t@t.com",
                        full_name: "T",
                        role: "client",
                        access_suspended: true,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "trainers") {
          const TR_PATCH = "t9999999-9999-4999-8999-999999999999";
          return {
            select: (cols?: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.head) return Promise.resolve({ count: 1, error: null });
              return {
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: TR_PATCH,
                        user_id: "x",
                        verified: true,
                        specialty: "Strength",
                        hourly_rate: 80,
                        bio: "Bio",
                        created_at: "2020-01-01T00:00:00.000Z",
                        profiles: { email: "trainer@t.com", full_name: "T", role: "trainer" },
                      },
                      error: null,
                    }),
                }),
              };
            },
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: TR_PATCH,
                        user_id: "x",
                        verified: true,
                        specialty: "Strength",
                        hourly_rate: 80,
                        bio: "Bio",
                        created_at: "2020-01-01T00:00:00.000Z",
                        profiles: { email: "trainer@t.com", full_name: "T", role: "trainer" },
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: () => Promise.resolve({ count: 1, error: null }),
          };
        }
        if (table === "support_tickets") {
          return {
            select: () => ({
              in: () => Promise.resolve({ count: 0, error: null }),
            }),
          };
        }
        if (table === "admin_audit_events") {
          return {
            select: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "audit-1",
                        action: "test_action",
                        target_type: "trainer",
                        target_id: "tr-1",
                        detail: {},
                        created_at: "2026-01-15T12:00:00.000Z",
                        actor_user_id: ADMIN_ID,
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === "verification_requests") {
          return {
            select: () => ({
              in: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
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

  it("GET /admin/review-timeline returns merged items", async () => {
    const token = signUserToken({ sub: ADMIN_ID, role: "admin" });
    const res = await request(app).get("/admin/review-timeline").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0]).toMatchObject({ source: "audit", action: "test_action" });
  });

  it("PATCH /admin/users/:id/access suspends a non-admin user", async () => {
    const token = signUserToken({ sub: ADMIN_ID, role: "admin" });
    const res = await request(app)
      .patch(`/admin/users/${TARGET_USER}/access`)
      .set("Authorization", `Bearer ${token}`)
      .send({ suspended: true })
      .expect(200);
    expect(res.body).toMatchObject({ id: TARGET_USER, access_suspended: true });
  });

  it("PATCH /admin/trainers/:id/verified updates trainer verification", async () => {
    const token = signUserToken({ sub: ADMIN_ID, role: "admin" });
    const trainerId = "t9999999-9999-4999-8999-999999999999";
    const res = await request(app)
      .patch(`/admin/trainers/${trainerId}/verified`)
      .set("Authorization", `Bearer ${token}`)
      .send({ verified: true })
      .expect(200);
    expect(res.body).toMatchObject({ id: trainerId, verified: true });
  });
});
