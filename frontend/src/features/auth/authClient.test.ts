import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value),
  };

  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
});

import { signInCustomer, signInWithEmailAndPassword, signUpCustomer } from "./authClient";

describe("signInWithEmailAndPassword", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the Auth endpoint beneath the configured gateway base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 400, msg: "Invalid login credentials" }), {
        headers: { "content-type": "application/json" },
        status: 400,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      signInWithEmailAndPassword({ email: "staff@bubbletea.test", password: "not-a-real-password" }),
    ).rejects.toBeDefined();

    const request = fetchMock.mock.calls[0]?.[0];
    const requestUrl = request instanceof Request ? request.url : String(request);
    expect(requestUrl).toBe("http://localhost:8000/auth/v1/token?grant_type=password");
  });

  it("provisions the Spring customer account after Auth returns a session", async () => {
    const now = Math.floor(Date.now() / 1000);
    const fetchMock = vi.fn().mockImplementation((...args: Parameters<typeof fetch>) => {
      const input = args[0];
      const request = input instanceof Request ? input : new Request(input);

      if (request.url === "http://localhost:8000/auth/v1/signup") {
        return Promise.resolve(new Response(JSON.stringify({
          access_token: "test-access-token",
          expires_at: now + 3600,
          expires_in: 3600,
          refresh_token: "test-refresh-token",
          token_type: "bearer",
          user: {
            app_metadata: { provider: "email", providers: ["email"] },
            aud: "authenticated",
            created_at: new Date().toISOString(),
            email: "customer@example.test",
            id: "c9ae7e89-46bd-4118-b4a2-f6fbf5e353ea",
            role: "authenticated",
            updated_at: new Date().toISOString(),
            user_metadata: {},
          },
        }), { headers: { "content-type": "application/json" }, status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({
        createdAt: new Date().toISOString(),
        email: "customer@example.test",
        id: "4f8b122a-c846-46d6-b8e0-305c61fbe80c",
      }), { headers: { "content-type": "application/json" }, status: 201 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(signUpCustomer({
      email: "customer@example.test",
      password: "a-long-customer-password",
    })).resolves.toEqual({ verificationRequired: false });

    const accountCall = fetchMock.mock.calls.find((call) => {
      const input = call[0];
      const request = input instanceof Request ? input : new Request(input, call[1]);
      return request.url.endsWith("/api/v1/customer/account");
    });
    const accountRequest = accountCall?.[0];
    expect(accountRequest).toBeInstanceOf(Request);
    expect((accountRequest as Request).method).toBe("POST");
    expect((accountRequest as Request).headers.get("authorization"))
      .toBe("Bearer test-access-token");
  });

  it("clears the local session when Spring account provisioning fails", async () => {
    const now = Math.floor(Date.now() / 1000);
    const fetchMock = vi.fn().mockImplementation((...args: Parameters<typeof fetch>) => {
      const input = args[0];
      const request = input instanceof Request ? input : new Request(input, args[1]);

      if (request.url.includes("/auth/v1/token?grant_type=password")) {
        return Promise.resolve(new Response(JSON.stringify({
          access_token: "partial-session-access-token",
          expires_at: now + 3600,
          expires_in: 3600,
          refresh_token: "partial-session-refresh-token",
          token_type: "bearer",
          user: {
            app_metadata: { provider: "email", providers: ["email"] },
            aud: "authenticated",
            created_at: new Date().toISOString(),
            email: "customer@example.test",
            id: "78faf63f-5709-401b-b6c3-f6f4b2ea13c2",
            role: "authenticated",
            updated_at: new Date().toISOString(),
            user_metadata: {},
          },
        }), { headers: { "content-type": "application/json" }, status: 200 }));
      }

      if (request.url.endsWith("/api/v1/customer/account")) {
        return Promise.resolve(new Response(null, { status: 503 }));
      }

      if (request.url.includes("/auth/v1/logout?scope=local")) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(signInCustomer({
      email: "customer@example.test",
      password: "a-long-customer-password",
    })).rejects.toThrow("Customer account provisioning failed.");

    expect(fetchMock.mock.calls.some((call) => {
      const input = call[0];
      const request = input instanceof Request ? input : new Request(input, call[1]);
      return request.url.includes("/auth/v1/logout?scope=local");
    })).toBe(true);
  });
});
