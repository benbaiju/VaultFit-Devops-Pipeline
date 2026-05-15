import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

app.listen(env.port, env.host, () => {
  const url = `http://127.0.0.1:${env.port}`;
  logger.info(
    { layer: "bootstrap", host: env.host, port: env.port, nodeEnv: env.nodeEnv },
    `VaultFit API listening on ${url} (bound to ${env.host})`,
  );
  logger.info({ layer: "bootstrap" }, `Quick check: curl -sS ${url}/  and  curl -sS ${url}/health`);
});
