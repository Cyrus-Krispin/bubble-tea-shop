import { afterEach, beforeEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  listener: undefined as undefined | ((event: string, session: unknown) => void),
  session: { access_token: "test-token", expires_at: 4102444800, user: { email: "test@example.test" } },
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: {
  getSession: sdk.getSession,
  signInWithPassword: sdk.signInWithPassword,
  onAuthStateChange: (listener: typeof sdk.listener) => {
    sdk.listener = listener;
    return { data: { subscription: { unsubscribe: sdk.unsubscribe } } };
  },
} }) }));
import { getCurrentAuthSession, signInCustomer, subscribeToAuthState } from "./authClient";

beforeEach(() => {
  sdk.session.expires_at = 4102444800;
  sdk.getSession.mockResolvedValue({ data: { session: sdk.session }, error: null });
  sdk.signInWithPassword.mockImplementation(async () => {
    sdk.listener?.("SIGNED_IN", sdk.session);
    return { data: { session: sdk.session }, error: null };
  });
});
afterEach(() => vi.unstubAllGlobals());

it("includes the absolute expiry and refuses an expired stored session", async () => {
  expect(await getCurrentAuthSession()).toEqual({ accessToken: "test-token", email: "test@example.test", expiresAt: 4102444800 });
  sdk.session.expires_at = 1;
  expect(await getCurrentAuthSession()).toBeNull();
});

it.each(["sign-out", "unsubscribe"])("ignores a delayed provisioning event after %s", async (action) => {
  let finish: (response: Response) => void = () => undefined;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; })));
  const listener = vi.fn();
  const unsubscribe = subscribeToAuthState(listener);
  const pending = signInCustomer({ email: "test@example.test", password: "test-password" });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  if (action === "sign-out") sdk.listener?.("SIGNED_OUT", null);
  else unsubscribe();
  finish(new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } }));
  await pending;
  await Promise.resolve();
  expect(listener.mock.calls.every(([value]) => value === null)).toBe(true);
  if (action === "sign-out") { expect(listener).toHaveBeenCalledWith(null); unsubscribe(); }
});
