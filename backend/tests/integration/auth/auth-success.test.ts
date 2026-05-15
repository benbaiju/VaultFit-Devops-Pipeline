import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

describe("auth login/register success (handlers mocked)", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule("../../../src/routes/auth-handlers.js", () => ({
      performLogin: jest.fn(async () => ({
        message: "Login successful",
        token: "mock-access-token",
        user: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          email: "client@test.dev",
          role: "client",
          full_name: "Test Client",
        },
      })),
      performRegister: jest.fn(async () => ({
        message: "User registered",
        token: "mock-register-token",
        user: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "new@test.dev", role: "client" },
      })),
    }));
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("POST /auth/login returns token payload", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "client@test.dev", "password": "password12" })
      .expect(200);
    expect(res.body).toMatchObject({ message: "Login successful", token: "mock-access-token" });
    expect(res.body.user).toMatchObject({ email: "client@test.dev", role: "client" });
  });

  it("POST /auth/register returns 201 with token payload", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({
        fullName: "New User",
        email: "newuser@test.dev",
        password: "password12",
        role: "client",
      })
      .expect(201);
    expect(res.body).toMatchObject({ message: "User registered", token: "mock-register-token" });
  });
});
