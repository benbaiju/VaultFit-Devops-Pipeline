import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

const UUID = "00000000-0000-4000-8000-000000000001";

/** Protected routes: requireAuth runs before DB; expect 401 without Authorization. */
const CASES: { method: "get" | "post" | "put" | "patch" | "delete"; path: string; body?: object }[] = [
  { method: "post", path: "/auth/change-password", body: { currentPassword: "x", newPassword: "yyyyyyyy" } },
  { method: "get", path: "/profiles/me" },
  { method: "put", path: "/profiles/me", body: {} },
  { method: "post", path: "/profiles/me/phone/send-otp", body: { phone: "+10000000000" } },
  { method: "post", path: "/profiles/me/phone/verify-otp", body: { otp: "000000" } },
  { method: "get", path: "/trainers/me/profile" },
  { method: "post", path: "/trainers", body: {} },
  { method: "put", path: `/trainers/${UUID}`, body: {} },
  { method: "post", path: `/trainers/${UUID}/services`, body: {} },
  { method: "post", path: `/trainers/${UUID}/availability`, body: {} },
  { method: "post", path: `/trainers/${UUID}/blocked-dates`, body: {} },
  { method: "get", path: "/bookings" },
  { method: "post", path: "/bookings", body: {} },
  { method: "patch", path: `/bookings/${UUID}/status`, body: { status: "confirmed" } },
  { method: "post", path: "/payments/initiate", body: {} },
  { method: "get", path: "/plans" },
  { method: "post", path: "/plans", body: {} },
  { method: "get", path: `/plans/${UUID}` },
  { method: "put", path: `/plans/${UUID}`, body: {} },
  { method: "delete", path: `/plans/${UUID}` },
  { method: "get", path: "/conversations" },
  { method: "post", path: "/conversations", body: {} },
  { method: "get", path: `/conversations/${UUID}/messages` },
  { method: "post", path: `/conversations/${UUID}/messages`, body: {} },
  { method: "patch", path: `/conversations/${UUID}/messages/read` },
  { method: "get", path: "/notifications" },
  { method: "patch", path: `/notifications/${UUID}/read` },
  { method: "patch", path: "/notifications/read-all" },
  { method: "post", path: "/tickets", body: {} },
  { method: "get", path: "/tickets" },
  { method: "get", path: `/tickets/${UUID}` },
  { method: "get", path: `/tickets/${UUID}/timeline` },
  { method: "post", path: `/tickets/${UUID}/comments`, body: {} },
  { method: "get", path: "/admin/tickets" },
  { method: "patch", path: `/admin/tickets/${UUID}`, body: {} },
  { method: "get", path: `/admin/tickets/${UUID}/timeline` },
  { method: "post", path: "/verification-requests", body: {} },
  { method: "get", path: "/verification-requests/me" },
  { method: "get", path: `/verification-requests/${UUID}` },
  { method: "get", path: `/verification-requests/${UUID}/document-url` },
  { method: "get", path: "/admin/verification-requests" },
  { method: "patch", path: `/admin/verification-requests/${UUID}`, body: {} },
  { method: "get", path: "/admin/users" },
  { method: "get", path: "/admin/review-timeline" },
  { method: "get", path: "/admin/trainers" },
  { method: "patch", path: `/admin/trainers/${UUID}/verified`, body: {} },
  { method: "patch", path: `/admin/users/${UUID}/access`, body: {} },
  { method: "post", path: `/bookings/${UUID}/review`, body: { rating: 5 } },
  { method: "delete", path: `/reviews/${UUID}` },
];

describe("protected routes without Authorization", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it.each(CASES)("$method $path → 401 UNAUTHORIZED", async ({ method, path, body }) => {
    const agent = request(app)[method](path).set("Accept", "application/json");
    const res = body != null ? agent.send(body) : agent;
    const out = await res.expect(401);
    expect(out.body).toMatchObject({ error: "UNAUTHORIZED" });
  });
});
