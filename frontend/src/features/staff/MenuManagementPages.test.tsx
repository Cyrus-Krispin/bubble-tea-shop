import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./menuClient", () => ({
  archiveMenuProduct: vi.fn(),
  archiveMenuVariant: vi.fn(),
  archiveOptionChoice: vi.fn(),
  archiveOptionGroup: vi.fn(),
  configureVariantOptionChoice: vi.fn(),
  createMenuOffering: vi.fn(),
  createMenuProduct: vi.fn(),
  createMenuVariant: vi.fn(),
  createOptionChoice: vi.fn(),
  createOptionGroup: vi.fn(),
  getMenuProduct: vi.fn(),
  getMenuProducts: vi.fn(),
  getOptionGroup: vi.fn(),
  getOptionGroups: vi.fn(),
  updateMenuOffering: vi.fn(),
  updateMenuProduct: vi.fn(),
  updateMenuVariant: vi.fn(),
  updateOptionChoice: vi.fn(),
  updateOptionGroup: vi.fn(),
  MenuError: class MenuError extends Error {
    constructor(
      public code: string,
      public status: number,
    ) {
      super(code);
    }
  },
}));
vi.mock("./ingredientClient", () => ({ getIngredients: vi.fn() }));
vi.mock("./recipeClient", () => ({ getRecipe: vi.fn(), getRecipes: vi.fn() }));

import MenuManagementPage from "./MenuManagementPage";
import MenuProductDetailPage from "./MenuProductDetailPage";
import OptionGroupDetailPage from "./OptionGroupDetailPage";
import { getIngredients } from "./ingredientClient";
import {
  configureVariantOptionChoice,
  createMenuProduct,
  createOptionChoice,
  getMenuProduct,
  getMenuProducts,
  getOptionGroup,
  getOptionGroups,
  updateMenuOffering,
} from "./menuClient";
import { getRecipe, getRecipes } from "./recipeClient";

const organizationId = "88b23060-cbc4-4218-9938-63d75f6f324c";
const locationId = "42eeb769-306a-4b1a-97cc-350e2e9ea90b";
const outletContext = {
  accessToken: "staff-token",
  staffContext: {
    accountId: "35f942a3-0591-4973-83ef-8889f608184e",
    memberships: [
      {
        organizationId,
        organizationName: "Bubble Tea Operations",
        role: "OWNER" as const,
        locations: [
          {
            id: locationId,
            name: "Orchard Central",
            timezone: "Asia/Singapore",
            defaultLocale: "en-SG",
            currencyCode: "SGD",
          },
        ],
      },
    ],
  },
};
const variant = {
  id: "variant",
  name: "Regular",
  displayOrder: 0,
  defaultVariant: true,
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
  choices: [],
};
const offering = {
  id: "offering",
  locationId,
  locationName: "Orchard Central",
  variantId: variant.id,
  variantName: variant.name,
  recipeVersionId: "recipe-version",
  recipeName: "House recipe",
  recipeVersionNumber: 1,
  priceMinor: 650,
  currencyCode: "SGD",
  available: false,
  version: 0,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
};
const product = {
  id: "product",
  publicSlug: "classic-milk-tea",
  name: "Classic Milk Tea",
  description: "House favorite",
  category: "Milk tea",
  artworkKey: null,
  imageUrl: null,
  displayOrder: 0,
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
  variants: [variant],
  offerings: [offering],
};
const choice = {
  id: "choice",
  name: "Less sugar",
  displayOrder: 0,
  defaultChoice: true,
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
};
const group = {
  id: "group",
  name: "Sweetness",
  minimumSelections: 1,
  maximumSelections: 1,
  displayOrder: 0,
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
  choices: [choice],
};

function renderPage(path: string, routePath: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={<Outlet context={outletContext} />}
          path="/staff/catalog"
        >
          <Route element={element} path={routePath} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("menu management pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMenuProducts).mockResolvedValue({
      items: [{ ...product, activeVariantCount: 1 }],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getMenuProduct).mockResolvedValue(product);
    vi.mocked(getOptionGroups).mockResolvedValue({
      items: [{ ...group, activeChoiceCount: 1 }],
      page: 0,
      size: 100,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getOptionGroup).mockResolvedValue(group);
    vi.mocked(getIngredients).mockResolvedValue({
      items: [],
      page: 0,
      size: 100,
      totalItems: 0,
      totalPages: 0,
    });
    vi.mocked(getRecipes).mockResolvedValue({
      items: [
        {
          id: "recipe",
          name: "House recipe",
          description: null,
          version: 0,
          archived: false,
          latestVersionNumber: 1,
          latestStatus: "PUBLISHED",
        },
      ],
      page: 0,
      size: 100,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getRecipe).mockResolvedValue({
      id: "recipe",
      name: "House recipe",
      description: null,
      version: 0,
      archived: false,
      createdAt: "2026-08-22T00:00:00Z",
      updatedAt: "2026-08-22T00:00:00Z",
      versions: [
        {
          id: "recipe-version",
          versionNumber: 1,
          status: "PUBLISHED",
          version: 0,
          createdAt: "2026-08-22T00:00:00Z",
          publishedAt: "2026-08-22T00:00:00Z",
          components: [],
        },
      ],
    });
  });

  it("lists and creates products in the server-returned organization", async () => {
    vi.mocked(createMenuProduct).mockResolvedValue(product);
    renderPage("/staff/catalog/menu", "menu", <MenuManagementPage />);
    expect(
      await screen.findByRole("cell", { name: "Classic Milk Tea" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Brown Sugar Milk" },
    });
    fireEvent.change(screen.getByLabelText("Public slug"), {
      target: { value: "brown-sugar-milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    await waitFor(() =>
      expect(createMenuProduct).toHaveBeenCalledWith(
        "staff-token",
        organizationId,
        {
          name: "Brown Sugar Milk",
          publicSlug: "brown-sugar-milk",
          description: null,
          category: null,
          imageUrl: null,
          artworkKey: null,
          displayOrder: 0,
        },
      ),
    );
  });

  it("creates choices in an option group and preserves optimistic scope", async () => {
    vi.mocked(createOptionChoice).mockResolvedValue(group);
    renderPage(
      `/staff/catalog/options/${group.id}?organizationId=${organizationId}`,
      "options/:groupId",
      <OptionGroupDetailPage />,
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Sweetness" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add choice" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "No sugar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save choice" }));
    await waitFor(() =>
      expect(createOptionChoice).toHaveBeenCalledWith(
        "staff-token",
        organizationId,
        group.id,
        { name: "No sugar", displayOrder: 0, defaultChoice: false },
      ),
    );
  });

  it("edits exact location pricing and configures a variant choice", async () => {
    vi.mocked(updateMenuOffering).mockResolvedValue({
      ...offering,
      priceMinor: 700,
      available: true,
      version: 1,
    });
    vi.mocked(configureVariantOptionChoice).mockResolvedValue({
      id: "configuration",
      choiceId: choice.id,
      choiceName: choice.name,
      groupId: group.id,
      groupName: group.name,
      priceDeltaMinor: -25,
      enabled: true,
      version: 0,
      ingredientEffects: [],
    });
    renderPage(
      `/staff/catalog/menu/${product.id}?organizationId=${organizationId}`,
      "menu/:productId",
      <MenuProductDetailPage />,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Classic Milk Tea",
      }),
    ).toBeVisible();
    expect(await screen.findByText(/650 SGD minor units/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit offering" }));
    fireEvent.change(screen.getByLabelText("Price (SGD minor units)"), {
      target: { value: "700" },
    });
    fireEvent.click(screen.getByLabelText("Available to guests"));
    fireEvent.click(screen.getByRole("button", { name: "Save offering" }));
    await waitFor(() =>
      expect(updateMenuOffering).toHaveBeenCalledWith(
        "staff-token",
        organizationId,
        locationId,
        offering.id,
        {
          recipeVersionId: "recipe-version",
          priceMinor: 700,
          available: true,
          version: 0,
        },
      ),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Add option choice" }),
    );
    fireEvent.change(screen.getByLabelText("Price delta (minor units)"), {
      target: { value: "-25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
    await waitFor(() =>
      expect(configureVariantOptionChoice).toHaveBeenCalledWith(
        "staff-token",
        organizationId,
        product.id,
        variant.id,
        choice.id,
        {
          enabled: true,
          priceDeltaMinor: -25,
          version: null,
          ingredientEffects: [],
        },
      ),
    );
  });
});
