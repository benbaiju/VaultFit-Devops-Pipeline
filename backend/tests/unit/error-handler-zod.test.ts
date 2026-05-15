import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { ZodError, z } from "zod";
import { errorHandler } from "../../src/middleware/error-handler.js";
import type { NextFunction, Request, Response } from "express";

describe("errorHandler Zod branch", () => {
  it("returns 400 with flattened details for ZodError", () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const schema = z.object({ name: z.string().min(2) });
    let zodErr: ZodError;
    try {
      schema.parse({ name: "x" });
      throw new Error("expected parse to fail");
    } catch (e) {
      zodErr = e as ZodError;
    }
    errorHandler(zodErr!, {} as Request, res, jest.fn() as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "VALIDATION_ERROR",
        details: expect.any(Object),
      }),
    );
  });
});
