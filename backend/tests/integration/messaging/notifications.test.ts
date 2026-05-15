import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUserToken } from "../../helpers/jwt.js";
import { supabaseAuthUnused } from "../../helpers/supabase-auth-profile.js";

const USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NOTIF_ID = "99999999-9999-4999-8999-999999999999";

describe("notifications routes", () => {
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
        if (table === "notifications") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  order: () =>
                    Promise.resolve({
                      data: [{ id: NOTIF_ID, title: "Hello", body: "World", is_read: false }],
                      error: null,
                    }),
                }),
              }),
            }),
            update: () => ({
              eq: (col: string) => {
                if (col === "user_id") {
                  return Promise.resolve({ error: null });
                }
                if (col === "id") {
                  return {
                    eq: () => ({
                      select: () => ({
                        single: () =>
                          Promise.resolve({
                            data: { id: NOTIF_ID, title: "Hello", is_read: true },
                            error: null,
                          }),
                      }),
                    }),
                  };
                }
                return Promise.resolve({ error: null });
              },
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

  it("GET /notifications returns rows for the user", async () => {
    const token = signUserToken({ sub: USER_ID, role: "client" });
    const res = await request(app).get("/notifications").set("Authorization", `Bearer ${token}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ title: "Hello" });
  });

  it("PATCH /notifications/:id/read marks one notification", async () => {
    const token = signUserToken({ sub: USER_ID, role: "client" });
    const res = await request(app)
      .patch(`/notifications/${NOTIF_ID}/read`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({ id: NOTIF_ID, is_read: true });
  });

  it("PATCH /notifications/read-all succeeds", async () => {
    const token = signUserToken({ sub: USER_ID, role: "client" });
    const res = await request(app)
      .patch("/notifications/read-all")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({ message: expect.stringMatching(/marked as read/i) });
  });
});
