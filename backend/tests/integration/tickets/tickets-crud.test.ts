import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const CLIENT_ID = "f1111111-1111-4111-8111-111111111111";
const ADMIN_ID = "f2222222-2222-4222-8222-222222222222";
const TICKET_ID = "f3333333-3333-4333-8333-333333333333";

const TICKET = {
  id: TICKET_ID,
  subject: "Billing question",
  description: "I need help with my invoice",
  created_by_user_id: CLIENT_ID,
  status: "open",
  priority: "normal",
  resolution_note: null,
  assigned_admin_user_id: null,
  category: "payment",
};

describe("support tickets (mocked Supabase)", () => {
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
              if (cols === "id" || String(cols).includes("id")) {
                return {
                  eq: () => Promise.resolve({ data: [{ id: ADMIN_ID }], error: null }),
                };
              }
              return { eq: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) };
            },
          };
        }
        if (table === "support_tickets") {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { ...TICKET }, error: null }),
              }),
            }),
            select: (cols?: string) => ({
              eq: (col: string, val: unknown) => {
                if (col === "id" && val === TICKET_ID) {
                  return {
                    single: () => Promise.resolve({ data: { ...TICKET }, error: null }),
                  };
                }
                if (col === "created_by_user_id") {
                  return {
                    order: () => Promise.resolve({ data: [{ ...TICKET }], error: null }),
                  };
                }
                return {
                  order: () => Promise.resolve({ data: [{ ...TICKET }], error: null }),
                };
              },
              order: () =>
                Object.assign(Promise.resolve({ data: [{ ...TICKET }], error: null }), {
                  eq: () => Promise.resolve({ data: [{ ...TICKET }], error: null }),
                }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { ...TICKET, status: "in_progress", subject: TICKET.subject },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "support_ticket_events") {
          return {
            insert: () => Promise.resolve({ error: null }),
            select: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [{ id: "ev-1", event_type: "created", ticket_id: TICKET_ID }], error: null }),
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

  it("POST /tickets creates a ticket", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subject: "Billing question",
        description: "I need help with my invoice please",
        category: "payment",
      })
      .expect(201);
    expect(res.body).toMatchObject({ id: TICKET_ID, status: "open" });
  });

  it("GET /tickets/:id returns the ticket for the owner", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app).get(`/tickets/${TICKET_ID}`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toMatchObject({ subject: TICKET.subject });
  });

  it("GET /tickets/:id/timeline returns events", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app).get(`/tickets/${TICKET_ID}/timeline`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ event_type: "created" });
  });

  it("POST /tickets/:id/comments accepts a comment", async () => {
    const token = signUserToken({ sub: CLIENT_ID, role: "client" });
    const res = await request(app)
      .post(`/tickets/${TICKET_ID}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ comment: "Thanks for the update." })
      .expect(201);
    expect(res.body).toMatchObject({ message: expect.stringMatching(/comment/i) });
  });

  it("GET /admin/tickets lists tickets for an admin", async () => {
    const token = signUserToken({ sub: ADMIN_ID, role: "admin" });
    const res = await request(app).get("/admin/tickets").set("Authorization", `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: TICKET_ID });
  });

  it("PATCH /admin/tickets/:id updates status", async () => {
    const token = signUserToken({ sub: ADMIN_ID, role: "admin" });
    const res = await request(app)
      .patch(`/admin/tickets/${TICKET_ID}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "in_progress" })
      .expect(200);
    expect(res.body).toMatchObject({ status: "in_progress" });
  });

  it("GET /admin/tickets/:id/timeline returns events", async () => {
    const token = signUserToken({ sub: ADMIN_ID, role: "admin" });
    const res = await request(app).get(`/admin/tickets/${TICKET_ID}/timeline`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
