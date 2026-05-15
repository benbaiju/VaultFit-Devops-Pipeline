import type { RequestHandler } from "express";

/** Tags `res.locals.routeModule` so HTTP and error logs can attribute the route group. */
export function tagRouteModule(name: string): RequestHandler {
  return (_req, res, next) => {
    res.locals.routeModule = name;
    next();
  };
}
