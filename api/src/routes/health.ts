import { Router } from "express";
import { supabaseAnon } from "../lib/supabase.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const { error } = await supabaseAnon.from("profiles").select("id").limit(1);

  if (error) {
    res.status(503).json({
      status: "degraded",
      db: "down",
      message: error.message,
    });
    return;
  }

  res.json({
    status: "ok",
    db: "up",
  });
});
