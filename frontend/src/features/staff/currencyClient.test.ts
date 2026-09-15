import { expect, it, vi } from "vitest";
import { getCurrencyPrices, saveCurrencyPrices, createOwnerLocation } from "./currencyClient";
it("sends explicit decimal prices as exact minor amounts and rejects missing values", async () => {
  const data = { variantId: "variant", currencyCode: "MYR", version: 3, choices: [{ linkId: "choice", groupName: "Toppings", choiceName: "Pearls", priceDeltaMinor: 150 }] };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 })); vi.stubGlobal("fetch", fetch);
  await saveCurrencyPrices("token", "org", data, { choice: "1.50" });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ version: 3, prices: [{ linkId: "choice", priceDeltaMinor: 150 }] });
  await expect(saveCurrencyPrices("token", "org", data, {})).rejects.toThrow("every choice");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("rejects malformed or unsupported currency responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ variantId: "variant", currencyCode: "USD", version: 0, choices: [] }))));
  await expect(getCurrencyPrices("token", "org", "variant", "MYR")).rejects.toThrow("Invalid currency");
});
it("preserves location conflicts as actionable errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 409 })));
  await expect(createOwnerLocation("token", "org", { name: "Shop", slug: "shop", currencyCode: "CNY", timezone: "Asia/Shanghai", defaultLocale: "zh-CN" })).rejects.toThrow("already exists");
});
