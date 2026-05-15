import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const TRAINER_USER = "i1111111-1111-4111-8111-111111111111";
const TRAINER_ID = "i2222222-2222-4222-8222-222222222222";
const VR_ID = "i4444444-4444-4444-8444-444444444444";

describe("verification routes (submit + admin, mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const vrRow = {
      id: VR_ID,
      trainer_id: TRAINER_ID,
      status: "pending",
      credential_url: "https://example.com/c.pdf",
      identity_url: "https://example.com/i.pdf",
      admin_notes: null,
      submitted_at: "2026-01-01T00:00:00.000Z",
      reviewed_at: null,
    };
    const supabaseAdmin = {
      auth: supabaseAuthUnused(),
      from: jest.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: (cols: string) => {
              if (String(cols).includes("access_suspended") && !String(cols).includes("email")) {
                return {
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { access_suspended: false }, error: null }),
                  }),
                };
              }
              if (String(cols).includes("created_at") && String(cols).includes("email")) {
                return {
                  order: () => Promise.resolve({ data: [{ id: TRAINER_USER, email: "t@t.com", full_name: "T", role: "trainer" }], error: null }),
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
                if (col === "user_id") {
                  return {
                    maybeSingle: () =>
                      val === TRAINER_USER
                        ? Promise.resolve({ data: { id: TRAINER_ID }, error: null })
                        : Promise.resolve({ data: null, error: null }),
                  };
                }
                if (col === "id" && val === TRAINER_ID && String(cols ?? "").includes("verified")) {
                  return {
                    single: () => Promise.resolve({ data: { verified: false }, error: null }),
                  };
                }
                if (col === "id" && val === TRAINER_ID && String(cols ?? "").includes("user_id")) {
                  return {
                    maybeSingle: () => Promise.resolve({ data: { user_id: TRAINER_USER }, error: null }),
                  };
                }
                return {
                  single: () => Promise.resolve({ data: null, error: { message: "not found" } }),
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                };
              },
            }),
            update: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        if (table === "verification_requests") {
          return {
            select: () => ({
              order: () => Promise.resolve({ data: [{ ...vrRow }], error: null }),
              eq: (col: string, val: unknown) => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
                single: () => Promise.resolve({ data: vrRow, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { ...vrRow }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: { ...vrRow, status: "approved", reviewed_at: "2026-01-02T00:00:00.000Z" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "notifications") {
          return { insert: () => Promise.resolve({ error: null }) };
        }
        if (table === "admin_audit_events") {
          return { insert: () => Promise.resolve({ error: null }) };
        }
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }),
    } as unknown as SupabaseClient;
    const supabaseAnon = { from: jest.fn() } as unknown as SupabaseClient;
    await jest.unstable_mockModule("../../../src/lib/supabase.js", () => ({ supabaseAdmin, supabaseAnon }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("POST /verification-requests creates a request with document URLs", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .post("/verification-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({
        credentialUrl: "https://example.com/c.pdf",
        identityUrl: "https://example.com/i.pdf",
      })
      .expect(201);
    expect(res.body).toMatchObject({ id: VR_ID, status: "pending" });
  });

  it("GET /verification-requests/:id returns the row for the owner", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app).get(`/verification-requests/${VR_ID}`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toMatchObject({ id: VR_ID, trainer_id: TRAINER_ID });
  });

  it("GET /verification-requests/:id/document-url returns direct URL for https refs", async () => {
    const token = signUserToken({ sub: TRAINER_USER, role: "trainer" });
    const res = await request(app)
      .get(`/verification-requests/${VR_ID}/document-url`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({ source: "direct", url: expect.stringContaining("https://") });
  });

  it("GET /admin/verification-requests lists for admin", async () => {
    const token = signUserToken({ sub: "a0000000-0000-4000-8000-000000000001", role: "admin" });
    const res = await request(app).get("/admin/verification-requests").set("Authorization", `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("PATCH /admin/verification-requests/:id approves", async () => {
    const token = signUserToken({ sub: "a0000000-0000-4000-8000-000000000001", role: "admin" });
    const res = await request(app)
      .patch(`/admin/verification-requests/${VR_ID}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "approved" })
      .expect(200);
    expect(res.body).toMatchObject({ status: "approved" });
  });

  it("GET /admin/users returns profiles", async () => {
    const token = signUserToken({ sub: "a0000000-0000-4000-8000-000000000001", role: "admin" });
    const res = await request(app).get("/admin/users").set("Authorization", `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
