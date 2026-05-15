import { beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("auth-handlers (mocked Supabase)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("performLogin returns token and user on success", async () => {
    const signInWithPassword = jest.fn(() =>
      Promise.resolve({
        data: {
          session: { access_token: "access-jwt" },
          user: { id: "user-1" },
        },
        error: null,
      }),
    );
    const supabaseAnon = { auth: { signInWithPassword } };
    const supabaseAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: { id: "user-1", email: "a@b.com", role: "client", full_name: "A", access_suspended: false },
                error: null,
              }),
          }),
        }),
      }),
    };
    await jest.unstable_mockModule("../../src/lib/supabase.js", () => ({ supabaseAnon, supabaseAdmin }));
    const { performLogin } = await import("../../src/routes/auth-handlers.js");
    const out = await performLogin({ email: "a@b.com", password: "secret1234" });
    expect(out.token).toBe("access-jwt");
    expect(out.user).not.toHaveProperty("access_suspended");
    expect(out.user).toMatchObject({ id: "user-1", role: "client" });
  });

  it("performLogin throws on invalid credentials", async () => {
    const signInWithPassword = jest.fn(() =>
      Promise.resolve({ data: { session: null, user: null }, error: { message: "bad" } }),
    );
    await jest.unstable_mockModule("../../src/lib/supabase.js", () => ({
      supabaseAnon: { auth: { signInWithPassword } },
      supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) },
    }));
    const { performLogin } = await import("../../src/routes/auth-handlers.js");
    await expect(performLogin({ email: "x@y.com", password: "wrongpass1" })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("performLogin throws when account is suspended", async () => {
    const signInWithPassword = jest.fn(() =>
      Promise.resolve({
        data: { session: { access_token: "t" }, user: { id: "u1" } },
        error: null,
      }),
    );
    const supabaseAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: { id: "u1", access_suspended: true, email: "x@y.com", role: "client" },
                error: null,
              }),
          }),
        }),
      }),
    };
    await jest.unstable_mockModule("../../src/lib/supabase.js", () => ({
      supabaseAnon: { auth: { signInWithPassword } },
      supabaseAdmin,
    }));
    const { performLogin } = await import("../../src/routes/auth-handlers.js");
    await expect(performLogin({ email: "x@y.com", password: "secret1234" })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("performRegister throws when email already exists", async () => {
    const supabaseAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: "existing" }, error: null }),
          }),
        }),
      }),
    };
    await jest.unstable_mockModule("../../src/lib/supabase.js", () => ({
      supabaseAnon: { auth: {} },
      supabaseAdmin,
    }));
    const { performRegister } = await import("../../src/routes/auth-handlers.js");
    await expect(
      performRegister({ fullName: "N", email: "taken@test.dev", password: "secret1234", role: "client" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("performRegister creates user and returns session", async () => {
    const newUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const deleteUser = jest.fn(() => Promise.resolve({}));
    const createUser = jest.fn(() =>
      Promise.resolve({
        data: { user: { id: newUserId } },
        error: null,
      }),
    );
    const signInWithPassword = jest.fn(() =>
      Promise.resolve({
        data: { session: { access_token: "reg-token" }, user: { id: newUserId } },
        error: null,
      }),
    );
    const supabaseAdmin = {
      auth: { admin: { createUser, deleteUser } },
      from: jest.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: () => Promise.resolve({ error: null }),
          };
        }
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
      }),
    };
    await jest.unstable_mockModule("../../src/lib/supabase.js", () => ({
      supabaseAnon: { auth: { signInWithPassword } },
      supabaseAdmin,
    }));
    const { performRegister } = await import("../../src/routes/auth-handlers.js");
    const out = await performRegister({
      fullName: "New User",
      email: "new@test.dev",
      password: "secret1234",
      role: "trainer",
    });
    expect(out.token).toBe("reg-token");
    expect(out.user).toEqual({ id: newUserId, email: "new@test.dev", role: "trainer" });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
