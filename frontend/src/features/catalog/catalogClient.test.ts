import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogMenu, catalogProduct } from "../../test/catalogFixtures";
import { getGuestMenu, getGuestProduct } from "./catalogClient";

afterEach(() => vi.unstubAllGlobals());

describe("catalogClient", () => {
  it("loads the current menu from Spring", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(catalogMenu), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getGuestMenu()).resolves.toEqual(catalogMenu);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/guest/menu", { signal: undefined });
  });

  it("encodes product slugs and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(catalogProduct), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getGuestProduct("milk tea/one")).resolves.toEqual(catalogProduct);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/guest/menu/products/milk%20tea%2Fone", { signal: undefined });
  });

  it("rejects malformed catalog responses instead of using fallback data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ products: "invalid" }), { status: 200 })));

    await expect(getGuestMenu()).rejects.toThrow("invalid catalog response");
  });

  it("reports unavailable resources without exposing server details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("internal details", { status: 500 })));

    await expect(getGuestProduct("moonlit-milk-tea")).rejects.toThrow("catalog could not be loaded");
  });
});
