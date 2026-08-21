import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archiveIngredient,
  createIngredient,
  getIngredients,
  IngredientError,
  updateIngredient,
} from "./ingredientClient";

const ingredient = {
  id: "a20d5547-69bb-4cb1-b9cc-d699629c49dc",
  name: "Assam Tea",
  sku: "TEA-001",
  baseUnit: "GRAM" as const,
  reorderThreshold: "1250.500000",
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("ingredientClient", () => {
  it("lists an authorized organization with encoded filters", async () => {
    const page = { items: [ingredient], page: 1, size: 25, totalItems: 26, totalPages: 2 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(page), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getIngredients("token", "org/id", {
      includeArchived: true,
      page: 1,
      query: "tea & milk",
      size: 25,
    })).resolves.toEqual(page);

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://localhost:3000/api/v1/staff/organizations/org%2Fid/ingredients?page=1&size=25&query=tea%20%26%20milk&includeArchived=true");
    expect(request.headers.get("authorization")).toBe("Bearer token");
  });

  it("creates, updates, and archives through the generated contract", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(ingredient), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...ingredient, name: "Ceylon Tea", version: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...ingredient, archived: true, version: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createIngredient("token", "org", {
      name: "Assam Tea", sku: "TEA-001", baseUnit: "GRAM", reorderThreshold: "1250.500000",
    });
    await updateIngredient("token", "org", ingredient.id, {
      name: "Ceylon Tea", sku: null, reorderThreshold: null, version: 0,
    });
    await archiveIngredient("token", "org", ingredient.id, 1);

    expect(await Promise.all(fetchMock.mock.calls.map(async ([input]) => ({
      body: await (input as Request).clone().text(),
      method: (input as Request).method,
    })))).toEqual([
      { method: "POST", body: JSON.stringify({ name: "Assam Tea", sku: "TEA-001", baseUnit: "GRAM", reorderThreshold: "1250.500000" }) },
      { method: "PUT", body: JSON.stringify({ name: "Ceylon Tea", sku: null, reorderThreshold: null, version: 0 }) },
      { method: "POST", body: JSON.stringify({ version: 1 }) },
    ]);
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...ingredient, version: "zero" }), { status: 200 }),
    ));

    await expect(createIngredient("token", "org", {
      name: "Tea", sku: null, baseUnit: "GRAM", reorderThreshold: null,
    })).rejects.toThrow("invalid ingredient response");
  });

  it("preserves stable problem codes and status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "INGREDIENT_VERSION_CONFLICT",
      detail: "database details are not exposed",
    }), { status: 409, headers: { "Content-Type": "application/problem+json" } })));

    await expect(archiveIngredient("token", "org", ingredient.id, 0)).rejects.toEqual(
      new IngredientError("INGREDIENT_VERSION_CONFLICT", 409),
    );
  });
});
