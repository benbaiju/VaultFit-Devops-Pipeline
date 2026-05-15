import { createModuleLogger } from "./logger.js";
import { HttpError } from "../middleware/error-handler.js";

const log = createModuleLogger("lib", "with-timeout");

/**
 * Fails fast when upstream (e.g. Supabase over HTTPS) hangs due to network, VPN, or firewall.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      log.warn({ operation, ms, msg: "upstream_timeout" }, "Upstream operation timed out");
      reject(
        new HttpError(
          504,
          `${operation} exceeded ${ms}ms. Your machine could not reach Supabase in time. Check NEXT_PUBLIC_SUPABASE_URL, try another network or VPN off/on, and ensure nothing blocks HTTPS to *.supabase.co.`,
          "UPSTREAM_TIMEOUT",
        ),
      );
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
