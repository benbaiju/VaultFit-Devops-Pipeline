import { ensureWebStorage, resetWebStorage } from "./ensure-web-storage";

// Must run before DOM/React imports: Jenkins JDK22 can inject a broken Node localStorage.
ensureWebStorage();

import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  resetWebStorage();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
