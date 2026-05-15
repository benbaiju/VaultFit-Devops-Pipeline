import { describe, expect, it, jest } from "@jest/globals";
import { HttpError, errorHandler } from "../../src/middleware/error-handler.js";
import type { NextFunction, Request, Response } from "express";

describe("errorHandler", () => {
  it("serializes HttpError as JSON", () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;
    errorHandler(new HttpError(418, "short and stout", "TEAPOT"), {} as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({
      error: "TEAPOT",
      message: "short and stout",
    });
  });
});
