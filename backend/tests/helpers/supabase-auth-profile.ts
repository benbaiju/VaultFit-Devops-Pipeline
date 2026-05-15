import { jest } from "@jest/globals";

/** `ensureAccessNotSuspended` reads profiles.access_suspended for the JWT subject. */
export function profilesAccessSuspendedChain() {
  return {
    select: (cols: string) => {
      if (String(cols).includes("access_suspended")) {
        return {
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { access_suspended: false }, error: null }),
          }),
        };
      }
      return {
        eq: () => ({
          single: () => Promise.resolve({ data: { email: "user@test.dev" }, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      };
    },
  };
}

export function supabaseAuthUnused() {
  return {
    getUser: jest.fn(async () => ({
      data: { user: null as null },
      error: { message: "unused in tests with HS256 JWT" },
    })),
  };
}
