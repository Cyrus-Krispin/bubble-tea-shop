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

import { signInWithEmailAndPassword } from "./authClient";

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
});
