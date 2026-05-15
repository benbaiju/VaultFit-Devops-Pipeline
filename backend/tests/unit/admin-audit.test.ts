import { beforeAll, describe, expect, it, jest } from "@jest/globals";

describe("recordAdminAudit", () => {
  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule("../../src/lib/supabase.js", () => ({
      supabaseAdmin: {
        from: () => ({
          insert: () => Promise.resolve({ error: null as null }),
        }),
      },
    }));
  });

  it("resolves when insert succeeds", async () => {
    const { recordAdminAudit } = await import("../../src/lib/admin-audit.js");
    await expect(
      recordAdminAudit({
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        action: "test_audit",
        targetType: "profile",
        targetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    ).resolves.toBeUndefined();
  });
});
