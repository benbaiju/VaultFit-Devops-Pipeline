import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, env.host, () => {
  const url = `http://127.0.0.1:${env.port}`;
  console.log(`VaultFit API listening on ${url} (bound to ${env.host})`);
  console.log(`  Quick check: curl -sS ${url}/  and  curl -sS ${url}/health`);
});
