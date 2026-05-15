/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:4000";

  return {
    plugins: [react()],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      fileParallelism: false,
      env: {
        VITE_API_URL: "http://127.0.0.1:4000",
      },
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
      },
    },
    server: {
      // If 5173 is taken, fail fast instead of switching ports (avoids a stale tab still using ws://localhost:5173).
      port: 5173,
      strictPort: true,
      // Allow Cloudflare quick tunnel hostnames for HTTPS device testing.
      allowedHosts: [".trycloudflare.com", "localhost", "127.0.0.1"],
      proxy: {
        // Same-origin in dev so opening the app via LAN IP still hits your machine's API.
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "") || "/",
        },
      },
    },
  };
});
