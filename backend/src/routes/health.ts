import { Router } from "express";
import { supabaseAnon } from "../lib/supabase.js";
import { withTimeout } from "../lib/with-timeout.js";
import { HttpError } from "../middleware/error-handler.js";
import { tagRouteModule } from "../middleware/route-module.js";

const READY_TIMEOUT_MS = Number(process.env.HEALTH_READY_TIMEOUT_MS ?? 8_000);

export const healthRouter = Router();
healthRouter.use(tagRouteModule("health"));

/**
 * Liveness: process is up; does not call Supabase (fast for Postman / load balancers).
 */
healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", liveness: true });
});

/**
 * Readiness: can reach the database through Supabase (may be slow or fail on bad network).
 */
healthRouter.get("/ready", async (_req, res, next) => {
  const check = async () => {
    const { error } = await supabaseAnon.from("profiles").select("id").limit(1);
    return { error };
  };

  try {
    const { error } = await withTimeout(check(), READY_TIMEOUT_MS, "Health /ready (Supabase)");
    if (error) {
      res.status(503).json({
        status: "degraded",
        db: "down",
        message: error.message,
      });
      return;
    }
    res.json({ status: "ok", db: "up", ready: true });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(504).json({
        status: "degraded",
        db: "timeout",
        message: err.message,
        code: err.code,
        hint: "Network or Supabase is not reachable in time. Use GET /health for a fast liveness check.",
      });
      return;
    }
    next(err);
  }
});
