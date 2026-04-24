import type { RequestUser } from "./auth.ts";

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export {};
