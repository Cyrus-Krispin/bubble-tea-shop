import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archiveMenuProduct,
  configureVariantOptionChoice,
  createMenuOffering,
  createMenuProduct,
  createMenuVariant,
  createOptionChoice,
  createOptionGroup,
  getMenuProduct,
  getMenuProducts,
  getOptionGroup,
  getOptionGroups,
  MenuError,
  updateMenuOffering,
  updateMenuProduct,
  updateMenuVariant,
  updateOptionChoice,
  updateOptionGroup,
} from "./menuClient";

const product = {
  id: "product",
  publicSlug: "classic-milk-tea",
  name: "Classic Milk Tea",
  description: null,
  category: "Milk tea",
  artworkKey: "classic-milk-tea",
  imageUrl: null,
  displayOrder: 1,
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
  variants: [],
  offerings: [],
};

const group = {
  id: "group",
  name: "Sweetness",
  minimumSelections: 1,
  maximumSelections: 1,
  displayOrder: 1,
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
  choices: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("menuClient", () => {
  it("lists and loads products and option groups using scoped filters", async () => {
    const productPage = {
      items: [{ ...product, activeVariantCount: 0 }],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    };
    const groupPage = {
      items: [{ ...group, activeChoiceCount: 0 }],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(productPage), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(product), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(groupPage), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(group), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await getMenuProducts("token", "org/id", {
      page: 0,
      size: 25,
      query: "milk & tea",
      includeArchived: true,
    });
    await getMenuProduct("token", "org/id", "product");
    await getOptionGroups("token", "org/id", { page: 0, size: 25 });
    await getOptionGroup("token", "org/id", "group", true);

    const requests = fetchMock.mock.calls.map(([input]) => input as Request);
    expect(requests[0]?.url).toBe(
      "http://localhost:3000/api/v1/staff/organizations/org%2Fid/menu-products?page=0&size=25&query=milk%20%26%20tea&includeArchived=true",
    );
    expect(requests[3]?.url).toContain("includeArchivedChoices=true");
    expect(
      requests.every(
        (request) => request.headers.get("authorization") === "Bearer token",
      ),
    ).toBe(true);
  });

  it("sends product, variant, group, and choice mutations with exact bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify(product), { status: 200 }),
          ),
        ),
    );

    const productInput = {
      publicSlug: "classic-milk-tea",
      name: "Classic Milk Tea",
      displayOrder: 1,
    };
    await createMenuProduct("token", "org", productInput);
    await updateMenuProduct("token", "org", "product", {
      ...productInput,
      description: null,
      imageUrl: null,
      category: null,
      artworkKey: null,
      version: 2,
    });
    await archiveMenuProduct("token", "org", "product", 2);
    await createMenuVariant("token", "org", "product", {
      name: "Large",
      displayOrder: 1,
      defaultVariant: true,
    });
    await updateMenuVariant("token", "org", "product", "variant", {
      name: "Regular",
      displayOrder: 0,
      defaultVariant: false,
      version: 3,
    });

    const bodies = await Promise.all(
      vi
        .mocked(fetch)
        .mock.calls.map(async ([input]) => (input as Request).clone().json()),
    );
    expect(bodies).toEqual([
      productInput,
      expect.objectContaining({ version: 2 }),
      { version: 2 },
      { name: "Large", displayOrder: 1, defaultVariant: true },
      { name: "Regular", displayOrder: 0, defaultVariant: false, version: 3 },
    ]);
  });

  it("sends offering and option configuration integers without currency or derived data", async () => {
    const offering = {
      id: "offering",
      locationId: "location",
      locationName: "Orchard",
      variantId: "variant",
      variantName: "Large",
      recipeVersionId: "recipe-version",
      recipeName: "House",
      recipeVersionNumber: 2,
      priceMinor: 650,
      currencyCode: "SGD",
      available: false,
      version: 0,
      createdAt: "2026-08-22T00:00:00Z",
      updatedAt: "2026-08-22T00:00:00Z",
    };
    const configured = {
      id: "configuration",
      choiceId: "choice",
      choiceName: "Less sugar",
      groupId: "group",
      groupName: "Sweetness",
      priceDeltaMinor: -25,
      enabled: true,
      version: 0,
      ingredientEffects: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(offering), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...offering, version: 1 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(configured), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createMenuOffering("token", "org", "location", {
      variantId: "variant",
      recipeVersionId: "recipe-version",
      priceMinor: 650,
      available: false,
    });
    await updateMenuOffering("token", "org", "location", "offering", {
      recipeVersionId: "recipe-version",
      priceMinor: 700,
      available: true,
      version: 0,
    });
    await configureVariantOptionChoice(
      "token",
      "org",
      "product",
      "variant",
      "choice",
      {
        enabled: true,
        priceDeltaMinor: -25,
        version: null,
        ingredientEffects: [],
      },
    );

    const bodies = await Promise.all(
      fetchMock.mock.calls.map(async ([input]) =>
        (input as Request).clone().json(),
      ),
    );
    expect(bodies[0]).not.toHaveProperty("currencyCode");
    expect(bodies[1]).toEqual({
      recipeVersionId: "recipe-version",
      priceMinor: 700,
      available: true,
      version: 0,
    });
    expect(bodies[2]).toEqual({
      enabled: true,
      priceDeltaMinor: -25,
      version: null,
      ingredientEffects: [],
    });
  });

  it("preserves option mutations and stable problem codes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(group), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(group), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(group), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(group), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "OPTION_STATE_CONFLICT" }), {
          status: 409,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createOptionGroup("token", "org", {
      name: "Sweetness",
      minimumSelections: 1,
      maximumSelections: 1,
      displayOrder: 0,
    });
    await updateOptionGroup("token", "org", "group", {
      name: "Sugar",
      minimumSelections: 0,
      maximumSelections: 1,
      displayOrder: 0,
      version: 0,
    });
    await createOptionChoice("token", "org", "group", {
      name: "Less",
      defaultChoice: true,
      displayOrder: 0,
    });
    await updateOptionChoice("token", "org", "group", "choice", {
      name: "Less sugar",
      defaultChoice: true,
      displayOrder: 0,
      version: 0,
    });
    await expect(
      updateOptionGroup("token", "org", "group", {
        name: "Sugar",
        minimumSelections: 2,
        maximumSelections: 1,
        displayOrder: 0,
        version: 0,
      }),
    ).rejects.toEqual(new MenuError("OPTION_STATE_CONFLICT", 409));
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ...product, variants: [{ choices: [] }] }),
            { status: 200 },
          ),
        ),
    );
    await expect(getMenuProduct("token", "org", "product")).rejects.toThrow(
      "invalid menu management response",
    );
  });
});
