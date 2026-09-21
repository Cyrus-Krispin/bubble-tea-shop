import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { catalogProduct } from "../../test/catalogFixtures";
import { createDefaultConfiguration } from "../catalog/pricing";
import { getCustomerOrderQuote } from "../auth/favoriteClient";
import { useCustomerQuote } from "./useCustomerQuote";
vi.mock("../auth/favoriteClient", () => ({ getCustomerOrderQuote: vi.fn() }));
const item = { id: "line", locationSlug: "shop", drinkId: "drink", drinkName: "Tea", configuration: createDefaultConfiguration(catalogProduct), unitPriceMinor: 1000, quantity: 1, currency: "SGD" };
beforeEach(() => vi.clearAllMocks());
it("uses server pricing for the signed-in checkout", async () => {
  vi.mocked(getCustomerOrderQuote).mockResolvedValue({ currencyCode: "SGD", subtotalMinor: 1000, discountMinor: 50, totalMinor: 950 });
  const { result } = renderHook(() => useCustomerQuote("token", [item]));
  await waitFor(() => expect(result.current.quote?.totalMinor).toBe(950));
});
it("ignores a stale quote after the signed-in identity changes", async () => {
  let finish: (value: { currencyCode: string; subtotalMinor: number; discountMinor: number; totalMinor: number }) => void = () => undefined;
  vi.mocked(getCustomerOrderQuote).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValue({ currencyCode: "SGD", subtotalMinor: 1000, discountMinor: 0, totalMinor: 1000 });
  const items = [item];
  const { result, rerender } = renderHook(({ token }) => useCustomerQuote(token, items), { initialProps: { token: "first" } });
  rerender({ token: "second" });
  await waitFor(() => expect(result.current.quote?.totalMinor).toBe(1000));
  await act(async () => finish({ currencyCode: "SGD", subtotalMinor: 1000, discountMinor: 50, totalMinor: 950 }));
  expect(result.current.quote?.totalMinor).toBe(1000);
});
