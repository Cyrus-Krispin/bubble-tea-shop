import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archiveRecipe,
  createRecipe,
  createRecipeVersion,
  getRecipe,
  getRecipes,
  publishRecipeVersion,
  RecipeError,
  replaceRecipeDraft,
  retireRecipeVersion,
  updateRecipe,
} from "./recipeClient";

const component = {
  ingredientId: "ef52dded-7060-4973-9077-2201437238e4",
  ingredientName: "Assam Tea",
  baseUnit: "GRAM" as const,
  quantity: "12.500000",
};

const version = {
  id: "532f1ca8-d9b9-493d-b428-4f924fd582aa",
  versionNumber: 1,
  status: "DRAFT" as const,
  version: 0,
  createdAt: "2026-08-22T00:00:00Z",
  publishedAt: null,
  components: [component],
};

const recipe = {
  id: "f4ad6804-c531-4229-86f4-30180d33b5ac",
  name: "Classic Milk Tea",
  description: "House black tea",
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
  versions: [version],
};

afterEach(() => vi.unstubAllGlobals());

describe("recipeClient", () => {
  it("lists and loads recipes through organization-scoped routes", async () => {
    const page = {
      items: [{
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        version: 0,
        archived: false,
        latestVersionNumber: 1,
        latestStatus: "DRAFT",
      }],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recipe), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRecipes("token", "org/id", {
      includeArchived: true, page: 0, query: "milk & tea", size: 25,
    })).resolves.toEqual(page);
    await expect(getRecipe("token", "org/id", recipe.id)).resolves.toEqual(recipe);

    const listRequest = fetchMock.mock.calls[0]?.[0] as Request;
    expect(listRequest.url).toBe("http://localhost:3000/api/v1/staff/organizations/org%2Fid/recipes?page=0&size=25&query=milk%20%26%20tea&includeArchived=true");
    expect(listRequest.headers.get("authorization")).toBe("Bearer token");
  });

  it("sends metadata and lifecycle mutations with optimistic versions", async () => {
    const responses = [recipe, { ...recipe, version: 1 }, { ...recipe, archived: true }, version,
      { ...version, version: 1 }, { ...version, status: "PUBLISHED", version: 2 },
      { ...version, status: "RETIRED", version: 3 }];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify(responses.shift()), { status: 200 }),
    )));

    await createRecipe("token", "org", { name: "Classic Milk Tea", description: null });
    await updateRecipe("token", "org", recipe.id, {
      name: "Milk Tea", description: "Updated", version: 0,
    });
    await archiveRecipe("token", "org", recipe.id, 1);
    await createRecipeVersion("token", "org", recipe.id, 1, version.id);
    await replaceRecipeDraft("token", "org", recipe.id, version.id, {
      version: 0,
      components: [{ ingredientId: component.ingredientId, quantity: "10.000000" }],
    });
    await publishRecipeVersion("token", "org", recipe.id, version.id, 1);
    await retireRecipeVersion("token", "org", recipe.id, version.id, 2);

    const fetchMock = vi.mocked(fetch);
    expect(await Promise.all(fetchMock.mock.calls.map(async ([input]) => ({
      body: await (input as Request).clone().text(),
      method: (input as Request).method,
      url: (input as Request).url,
    })))).toEqual([
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Classic Milk Tea", description: null }) }),
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ name: "Milk Tea", description: "Updated", version: 0 }) }),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ version: 1 }) }),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ version: 1, sourceVersionId: version.id }) }),
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ version: 0, components: [{ ingredientId: component.ingredientId, quantity: "10.000000" }] }) }),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ version: 1 }) }),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ version: 2 }) }),
    ]);
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...recipe, versions: [{ ...version, status: "LIVE" }] }),
        { status: 200 }),
    ));

    await expect(getRecipe("token", "org", recipe.id))
      .rejects.toThrow("invalid recipe response");
  });

  it("preserves stable recipe problem codes and status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "RECIPE_VERSION_CONFLICT",
    }), { status: 409, headers: { "Content-Type": "application/problem+json" } })));

    await expect(archiveRecipe("token", "org", recipe.id, 0)).rejects.toEqual(
      new RecipeError("RECIPE_VERSION_CONFLICT", 409),
    );
  });
});
