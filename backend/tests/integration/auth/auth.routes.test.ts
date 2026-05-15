import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

describe("auth middleware", () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const mod = await import("../../../src/app.js");
    app = mod.app;
  });

  it("returns 401 when Authorization is missing for /admin/stats", async () => {
    const res = await request(app).get("/admin/stats").expect(401);
    expect(res.body).toMatchObject({ error: "UNAUTHORIZED" });
  });
});
