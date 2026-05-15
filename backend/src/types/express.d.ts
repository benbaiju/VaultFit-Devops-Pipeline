import type { RequestUser } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
    interface Locals {
      routeModule?: string;
    }
  }
}

export {};
