import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { AuthSession } from "../auth/types";
import type { CartItem } from "./cartReducer";
import { OrderError, placeGuestOrder, type GuestOrder } from "./orderClient";
import { CartProvider } from "./CartProvider";
import { useCart } from "./CartContext";
vi.mock("./orderClient", () => ({ placeGuestOrder: vi.fn(), OrderError: class extends Error { constructor(public code: string, public status: number) { super(code); } } }));
const item: CartItem = { id: "line", drinkId: "tea", drinkName: "Tea", locationSlug: "shop", currency: "SGD", quantity: 1, unitPriceMinor: 500,
  configuration: { variantId: "variant", variantName: "Medium", selections: [] } };
const session: AuthSession = { userId: "test-user", accessToken: "a", email: "customer@example.test", expiresAt: 2_000_000_000 };
const receipt = { status: "COMPLETED", totalMinor: 500 } as GuestOrder;
beforeEach(() => { vi.resetAllMocks(); });
function setup() { const view = renderHook(() => useCart(), { wrapper: CartProvider }); act(() => view.result.current.addItem(item)); return view; }
it("retains the original payload and key through network, 5xx, and later 4xx failures", async () => {
  vi.mocked(placeGuestOrder).mockRejectedValueOnce(new TypeError("lost"))
    .mockRejectedValueOnce(new OrderError("ORDER_UNAVAILABLE", 502)).mockRejectedValueOnce(new OrderError("ORDER_UNAVAILABLE", 403)).mockResolvedValueOnce(receipt);
  const { result } = setup();
  await act(() => result.current.checkout(session));
  act(() => { result.current.incrementItem(result.current.items[0].id); result.current.removeItem(result.current.items[0].id); result.current.addItem(item); });
  expect(result.current.itemCount).toBe(1);
  await act(() => result.current.checkout({ ...session, accessToken: "refreshed" }));
  await act(() => result.current.checkout(session));
  expect(result.current.checkoutState.attempt).toBeDefined();
  await act(() => result.current.checkout(session));
  expect(new Set(vi.mocked(placeGuestOrder).mock.calls.map((call) => call[1])).size).toBe(1);
  expect(vi.mocked(placeGuestOrder).mock.calls.every((call) => call[0].items[0].quantity === 1)).toBe(true);
  expect(result.current.checkoutState.result?.status).toBe("COMPLETED");
  expect(result.current.itemCount).toBe(0);
});
it("requires the original account after expiry or replacement", async () => {
  vi.mocked(placeGuestOrder).mockRejectedValue(new TypeError("lost"));
  const { result } = setup();
  await act(() => result.current.checkout(session));
  await act(() => result.current.checkout(null));
  await act(() => result.current.checkout({ ...session, userId: "other-user" }));
  expect(placeGuestOrder).toHaveBeenCalledTimes(1);
  await act(() => result.current.checkout({ ...session, accessToken: "new-token" }));
  expect(vi.mocked(placeGuestOrder).mock.calls[1][2]).toBe("new-token");
});
it("keeps an anonymous attempt anonymous after sign in", async () => {
  vi.mocked(placeGuestOrder).mockRejectedValue(new TypeError("lost"));
  const { result } = setup();
  await act(() => result.current.checkout(null));
  await act(() => result.current.checkout(session));
  expect(vi.mocked(placeGuestOrder).mock.calls[1][2]).toBeUndefined();
});
it("keeps a single request in flight across consumer remounts and clears once", async () => {
  let resolve!: (value: GuestOrder) => void;
  vi.mocked(placeGuestOrder).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result, rerender } = setup();
  let pending!: Promise<void>;
  act(() => { pending = result.current.checkout(session); });
  rerender();
  await act(() => result.current.checkout(session));
  expect(placeGuestOrder).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(receipt); await pending; });
  expect(result.current.itemCount).toBe(0);
});
it("unlocks a first definite rejection for menu corrections", async () => {
  vi.mocked(placeGuestOrder).mockRejectedValue(new OrderError("ORDER_CATALOG_CHANGED", 409));
  const { result } = setup();
  await act(() => result.current.checkout(session));
  expect(result.current.checkoutState.attempt).toBeUndefined();
  act(() => result.current.incrementItem(result.current.items[0].id));
  expect(result.current.itemCount).toBe(2);
});
