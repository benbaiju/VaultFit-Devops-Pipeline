import { describe, expect, it } from "@jest/globals";
import { withTimeout } from "../../src/lib/with-timeout.js";
import { HttpError } from "../../src/middleware/error-handler.js";

describe("withTimeout", () => {
  it("resolves when the promise settles before the deadline", async () => {
    const result = await withTimeout(Promise.resolve(42), 500, "test-op");
    expect(result).toBe(42);
  });

  it("rejects with HttpError when the promise exceeds the deadline", async () => {
    const slow = new Promise<number>(() => {
      /* never resolves */
    });
    await expect(withTimeout(slow, 20, "slow-op")).rejects.toMatchObject({
      statusCode: 504,
      code: "UPSTREAM_TIMEOUT",
    });
  }, 10_000);
});
