import { jest } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimal chain mocks for admin `/admin/stats` + `ensureAccessNotSuspended` on profiles. */
export function createAdminStatsSupabaseMocks() {
  const supabaseAdmin = {
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: null as null },
        error: { message: "should not be called when JWT is used" },
      })),
    },
    from: jest.fn((table: string) => {
      if (table === "support_tickets") {
        return {
          select: () => ({
            in: () => Promise.resolve({ count: 2, error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: (cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return Promise.resolve({ count: 11, error: null });
            }
            if (String(cols).includes("access_suspended")) {
              return {
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { access_suspended: false }, error: null }),
                }),
              };
            }
            return Promise.resolve({ data: [], error: null });
          },
        };
      }
      if (table === "trainers") {
        return {
          select: () => Promise.resolve({ count: 4, error: null }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => Promise.resolve({ count: 9, error: null }),
        };
      }
      return {
        select: () => Promise.resolve({ data: null, error: null }),
      };
    }),
  } as unknown as SupabaseClient;

  const supabaseAnon = {
    from: jest.fn(() => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    })),
  } as unknown as SupabaseClient;

  return { supabaseAdmin, supabaseAnon };
}
