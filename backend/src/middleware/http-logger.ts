import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { HttpLogger, Options } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../lib/logger.js";

const requireCjs = createRequire(import.meta.url);
const pinoHttp = requireCjs("pino-http") as (opts?: Options) => HttpLogger;

export const httpLogger = pinoHttp({
  logger,
  genReqId(req: IncomingMessage, _res: ServerResponse) {
    const header = req.headers["x-request-id"];
    if (typeof header === "string" && header.trim().length > 0) return header.trim();
    return randomUUID();
  },
  customProps(_req: IncomingMessage, res: ServerResponse) {
    const locals = (res as ServerResponse & { locals?: { routeModule?: string } }).locals;
    return { layer: "http", routeModule: locals?.routeModule };
  },
  customLogLevel(_req: IncomingMessage, res: ServerResponse, err?: Error) {
    if (err) return "error";
    if (res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(req: IncomingMessage) {
      return { id: req.id, method: req.method, url: req.url };
    },
    res(res: ServerResponse) {
      return { statusCode: res.statusCode };
    },
  },
});
