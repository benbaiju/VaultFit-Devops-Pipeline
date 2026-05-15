import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

describe("auth request validation", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("POST /auth/login rejects invalid payload with 400", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "not-an-email", password: "short" })
      .expect(400);
    expect(res.body).toMatchObject({ error: "VALIDATION_ERROR" });
  });

  it("POST /auth/register rejects invalid payload with 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ fullName: "A", email: "bad", password: "short", role: "client" })
      .expect(400);
    expect(res.body).toMatchObject({ error: "VALIDATION_ERROR" });
  });
});
