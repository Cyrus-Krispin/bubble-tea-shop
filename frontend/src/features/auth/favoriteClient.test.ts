import { afterEach, expect, it, vi } from "vitest";
import { getCustomerOrderQuote, saveFavorite } from "./favoriteClient";
afterEach(() => vi.unstubAllGlobals());
it("saves a recipe using the current authenticated customer only", async () => {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recipeId: "recipe", recipeName: "Tea", recipes: [{ id: "recipe", name: "Tea" }], discountPercent: 5 }), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", mock);
  await saveFavorite("token", "shop", "recipe");
  const request = mock.mock.calls[0][0] as Request;
  expect(request.method).toBe("PUT"); expect(request.headers.get("Authorization")).toBe("Bearer token");
  expect(await request.json()).toEqual({ recipeId: "recipe" });
});
it("rejects a malformed or inconsistent checkout discount", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ currencyCode: "SGD", subtotalMinor: 1000, discountMinor: 50, totalMinor: 1000 }), { headers: { "Content-Type": "application/json" } })));
  await expect(getCustomerOrderQuote("token", "shop", { items: [] })).rejects.toThrow("Current prices unavailable");
});
