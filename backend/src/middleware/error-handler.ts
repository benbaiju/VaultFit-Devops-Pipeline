import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code = "HTTP_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const log = req.log ?? logger.child({ layer: "middleware", module: "error-handler" });
  const routeModule = res.locals?.routeModule;

  if (err instanceof ZodError) {
    log.warn({ routeModule, msg: "validation_error", issueCount: err.issues.length }, "Request validation failed");
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid request payload",
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof HttpError) {
    const payload = {
      err: { message: err.message, code: err.code, stack: err.stack },
      statusCode: err.statusCode,
      routeModule,
      msg: "http_error" as const,
    };
    if (err.statusCode >= 500) {
      log.error(payload, err.message);
    } else {
      log.warn(payload, err.message);
    }
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  log.error({ err, routeModule, msg: "unhandled_error" }, "Unhandled error");
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
  });
}
