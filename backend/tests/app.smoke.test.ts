import request from "supertest";
import type { Express } from "express";

describe("HTTP smoke", () => {
  let app: Express;

  beforeAll(async () => {
    const mod = await import("../src/app.js");
    app = mod.app;
  });

  it("GET / returns service payload", async () => {
    const res = await request(app).get("/").expect(200);
    expect(res.body).toMatchObject({ service: "vaultfit-api", status: "ok" });
  });

  it("GET /health returns liveness without calling Supabase", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", liveness: true });
  });
});
