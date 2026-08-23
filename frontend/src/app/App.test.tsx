import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogMenu, catalogProduct } from "../test/catalogFixtures";

vi.mock("../features/auth/authClient", () => ({
  getCurrentAuthSession: vi.fn().mockResolvedValue(null),
  signInCustomer: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  signUpCustomer: vi.fn(),
  subscribeToAuthState: vi.fn().mockReturnValue(() => undefined),
}));
vi.mock("../features/catalog/catalogClient", () => ({
  getGuestMenu: vi.fn(),
  getGuestProduct: vi.fn(),
}));
vi.mock("../features/staff/staffClient", () => ({
  getStaffContext: vi.fn(),
  StaffContextError: class StaffContextError extends Error {
    constructor(public code: string, public status: number) {
      super(code);
    }
  },
}));
vi.mock("../features/staff/ingredientClient", () => ({
  archiveIngredient: vi.fn(),
  createIngredient: vi.fn(),
  getIngredients: vi.fn(),
  IngredientError: class IngredientError extends Error {
    constructor(public code: string, public status: number) {
      super(code);
    }
  },
  updateIngredient: vi.fn(),
}));
vi.mock("../features/staff/recipeClient", () => ({
  archiveRecipe: vi.fn(),
  createRecipe: vi.fn(),
  createRecipeVersion: vi.fn(),
  getRecipe: vi.fn(),
  getRecipes: vi.fn(),
  publishRecipeVersion: vi.fn(),
  RecipeError: class RecipeError extends Error {
    constructor(public code: string, public status: number) {
      super(code);
    }
  },
  replaceRecipeDraft: vi.fn(),
  retireRecipeVersion: vi.fn(),
  updateRecipe: vi.fn(),
}));

import { App } from "./App";
import { getCurrentAuthSession } from "../features/auth/authClient";
import { getGuestMenu, getGuestProduct } from "../features/catalog/catalogClient";
import { getStaffContext, StaffContextError } from "../features/staff/staffClient";
import {
  archiveIngredient,
  createIngredient,
  getIngredients,
  IngredientError,
  updateIngredient,
} from "../features/staff/ingredientClient";
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
} from "../features/staff/recipeClient";

const scrollToMock = vi.fn();

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

const managedIngredient = {
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

const managedRecipeVersion = {
  id: "532f1ca8-d9b9-493d-b428-4f924fd582aa",
  versionNumber: 1,
  status: "DRAFT" as const,
  version: 0,
  createdAt: "2026-08-22T00:00:00Z",
  publishedAt: null,
  components: [{
    ingredientId: managedIngredient.id,
    ingredientName: managedIngredient.name,
    baseUnit: managedIngredient.baseUnit,
    quantity: "12.500000",
  }],
};

const managedRecipe = {
  id: "f4ad6804-c531-4229-86f4-30180d33b5ac",
  name: "Classic Milk Tea",
  description: "House black tea",
  version: 0,
  archived: false,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
  versions: [managedRecipeVersion],
};

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("scrollTo", scrollToMock);
    vi.mocked(getCurrentAuthSession).mockResolvedValue(null);
    vi.mocked(getGuestMenu).mockResolvedValue(catalogMenu);
    vi.mocked(getGuestProduct).mockResolvedValue(catalogProduct);
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [],
    });
    vi.mocked(getIngredients).mockResolvedValue({
      items: [managedIngredient], page: 0, size: 25, totalItems: 1, totalPages: 1,
    });
    vi.mocked(createIngredient).mockResolvedValue(managedIngredient);
    vi.mocked(updateIngredient).mockResolvedValue({ ...managedIngredient, version: 1 });
    vi.mocked(archiveIngredient).mockResolvedValue({ ...managedIngredient, version: 1, archived: true });
    vi.mocked(getRecipes).mockResolvedValue({
      items: [{
        id: managedRecipe.id,
        name: managedRecipe.name,
        description: managedRecipe.description,
        version: 0,
        archived: false,
        latestVersionNumber: 1,
        latestStatus: "DRAFT",
      }],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getRecipe).mockResolvedValue(managedRecipe);
    vi.mocked(createRecipe).mockResolvedValue(managedRecipe);
    vi.mocked(updateRecipe).mockResolvedValue({ ...managedRecipe, version: 1 });
    vi.mocked(archiveRecipe).mockResolvedValue({ ...managedRecipe, archived: true, version: 1 });
    vi.mocked(createRecipeVersion).mockResolvedValue(managedRecipeVersion);
    vi.mocked(replaceRecipeDraft).mockResolvedValue({ ...managedRecipeVersion, version: 1 });
    vi.mocked(publishRecipeVersion).mockResolvedValue({
      ...managedRecipeVersion, status: "PUBLISHED", version: 1,
    });
    vi.mocked(retireRecipeVersion).mockResolvedValue({
      ...managedRecipeVersion, status: "RETIRED", version: 1,
    });
  });

  it("offers sign in and account creation on one customer access surface", async () => {
    render(
      <MemoryRouter initialEntries={["/account/access?mode=create"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("main")).toHaveAccessibleName("Customer access");
    expect(screen.getByRole("heading", { level: 1, name: "Create your account" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Account access options" }).querySelector("a")).toHaveAttribute(
      "href",
      "/account/access?mode=sign-in",
    );
    expect(screen.getByRole("link", { name: "Continue to menu" })).toHaveAttribute("href", "/");
  });

  it("preserves a safe return path from the legacy customer sign-in route", async () => {
    render(
      <MemoryRouter initialEntries={["/account/sign-in?next=/cart"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("main")).toHaveAccessibleName("Customer access");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/account/access?mode=create&next=%2Fcart",
    );
  });

  it("shows the signed-in customer account without granting a staff role", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "customer-token",
      email: "customer@example.test",
    });

    render(
      <MemoryRouter initialEntries={["/account"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("customer@example.test")).toBeVisible();
    expect(screen.getByText("Customer account")).toBeVisible();
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    expect(screen.queryByText("Manager")).not.toBeInTheDocument();
  });

  it("does not offer registration to an already signed-in account", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "customer-token",
      email: "customer@example.test",
    });

    render(
      <MemoryRouter initialEntries={["/account/access?mode=create"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("customer@example.test")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
  });

  it("opens directly on the API-backed menu", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("main", { name: "Guest shop" })).toBeVisible();
    expect(document.querySelector("img.brand-icon")).toHaveAttribute("src", "/app-icon-192.png");
    expect(screen.getByRole("heading", { level: 1, name: "Drinks made your way" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Moonlit Milk Tea" })).toBeVisible();
  });

  it("keeps staff sign-in on its own route", () => {
    render(
      <MemoryRouter initialEntries={["/staff/sign-in"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("main")).toHaveAccessibleName("Staff sign in");
    expect(screen.getByRole("heading", { level: 1, name: "Staff sign in" })).toBeVisible();
    expect(screen.getByText("Use the account assigned to your shop role.")).toBeVisible();
  });

  it("shows a useful recovery page for unknown routes", async () => {
    render(
      <MemoryRouter initialEntries={["/missing-page"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to menu" })).toHaveAttribute("href", "/");
  });

  it("guards the staff workspace and renders only server-returned scope", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token",
      email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [{
          id: "42eeb769-306a-4b1a-97cc-350e2e9ea90b",
          name: "Orchard Central",
          timezone: "Asia/Singapore",
          defaultLocale: "en-SG",
          currencyCode: "SGD",
        }],
      }],
    });

    render(
      <MemoryRouter initialEntries={["/staff"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Operations overview" })).toBeVisible();
    expect(screen.getByRole("main", { name: "Staff workspace" })).toBeVisible();
    expect(await screen.findByText("Bubble Tea Operations")).toBeVisible();
    expect(screen.getByText("Owner")).toBeVisible();
    expect(screen.getByText("Orchard Central")).toBeVisible();
    expect(getStaffContext).toHaveBeenCalledWith("staff-token", expect.any(AbortSignal));
  });

  it("redirects signed-out visitors from the staff workspace to staff sign in", async () => {
    render(
      <MemoryRouter initialEntries={["/staff"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("main", { name: "Staff sign in" })).toBeVisible();
    expect(getStaffContext).not.toHaveBeenCalled();
  });

  it("preserves the exact staff deep link while requesting sign in", async () => {
    render(
      <MemoryRouter initialEntries={["/staff/orders?status=PENDING"]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("main", { name: "Staff sign in" })).toBeVisible();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/staff/sign-in?next=%2Fstaff%2Forders%3Fstatus%3DPENDING",
    );
  });

  it("shows a generic no-access state without inventing an organization", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "customer-token",
      email: "customer@example.test",
    });
    vi.mocked(getStaffContext).mockRejectedValue(
      new StaffContextError("STAFF_ACCESS_DENIED", 403),
    );

    render(
      <MemoryRouter initialEntries={["/staff"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "No active staff access" })).toBeVisible();
    expect(screen.getByText(/does not have an active staff membership/i)).toBeVisible();
    expect(screen.queryByText("Bubble Tea Operations")).not.toBeInTheDocument();
  });

  it("manages ingredients inside server-returned organization scope", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token",
      email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [],
      }],
    });

    render(
      <MemoryRouter initialEntries={["/staff/catalog/ingredients"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Ingredients" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("cell", { name: "Assam Tea" })).toBeVisible();
    expect(getIngredients).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      { includeArchived: false, page: 0, query: undefined, size: 25 },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add ingredient" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Pearls" } });
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "PEARL-1" } });
    fireEvent.change(screen.getByLabelText("Base unit"), { target: { value: "EACH" } });
    fireEvent.click(screen.getByRole("button", { name: "Create ingredient" }));

    await waitFor(() => expect(createIngredient).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      { name: "Pearls", sku: "PEARL-1", baseUnit: "EACH", reorderThreshold: null },
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ceylon Tea" } });
    expect(screen.getByLabelText("Base unit")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateIngredient).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      managedIngredient.id,
      {
        name: "Ceylon Tea",
        sku: "TEA-001",
        reorderThreshold: "1250.500000",
        version: 0,
      },
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive ingredient" }));
    await waitFor(() => expect(archiveIngredient).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      managedIngredient.id,
      0,
    ));
  });

  it("refreshes the list and explains an optimistic edit conflict", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token",
      email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [],
      }],
    });
    vi.mocked(updateIngredient).mockRejectedValueOnce(
      new IngredientError("INGREDIENT_VERSION_CONFLICT", 409),
    );

    render(
      <MemoryRouter initialEntries={["/staff/catalog/ingredients"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed since you opened it/i);
    await waitFor(() => expect(getIngredients).toHaveBeenCalledTimes(2));
  });

  it("lists and creates recipes inside server-returned organization scope", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token",
      email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [],
      }],
    });

    render(
      <MemoryRouter initialEntries={["/staff/catalog/recipes"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Recipes" })).toBeVisible();
    expect(await screen.findByRole("cell", { name: "Classic Milk Tea" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      `/staff/catalog/recipes/${managedRecipe.id}?organizationId=88b23060-cbc4-4218-9938-63d75f6f324c`,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Brown Sugar Milk" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Caramelized brown sugar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create recipe" }));

    await waitFor(() => expect(createRecipe).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      { name: "Brown Sugar Milk", description: "Caramelized brown sugar" },
    ));
  });

  it("edits a draft formula using live ingredients", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token",
      email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [],
      }],
    });

    render(
      <MemoryRouter initialEntries={[
        `/staff/catalog/recipes/${managedRecipe.id}?organizationId=88b23060-cbc4-4218-9938-63d75f6f324c`,
      ]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Classic Milk Tea" })).toBeVisible();
    expect(screen.getByText("Assam Tea")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit formula" }));
    fireEvent.change(screen.getByLabelText("Quantity 1"), { target: { value: "15.000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save formula" }));

    await waitFor(() => expect(replaceRecipeDraft).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      managedRecipe.id,
      managedRecipeVersion.id,
      {
        version: 0,
        components: [{ ingredientId: managedIngredient.id, quantity: "15.000000" }],
      },
    ));
  });

  it("reloads recipe state and explains a formula version conflict", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token", email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [],
      }],
    });
    vi.mocked(replaceRecipeDraft).mockRejectedValueOnce(
      new RecipeError("RECIPE_VERSION_CONFLICT", 409),
    );
    render(
      <MemoryRouter initialEntries={[
        `/staff/catalog/recipes/${managedRecipe.id}?organizationId=88b23060-cbc4-4218-9938-63d75f6f324c`,
      ]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 1, name: "Classic Milk Tea" });
    fireEvent.click(screen.getByRole("button", { name: "Edit formula" }));
    fireEvent.click(screen.getByRole("button", { name: "Save formula" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed since you opened it/i);
    await waitFor(() => expect(getRecipe).toHaveBeenCalledTimes(2));
  });

  it("updates recipe metadata and confirms publication and archival", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token", email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [],
      }],
    });
    render(
      <MemoryRouter initialEntries={[
        `/staff/catalog/recipes/${managedRecipe.id}?organizationId=88b23060-cbc4-4218-9938-63d75f6f324c`,
      ]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 1, name: "Classic Milk Tea" });
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "House Milk Tea" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(updateRecipe).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      managedRecipe.id,
      { name: "House Milk Tea", description: "House black tea", version: 0 },
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish version" }));
    await waitFor(() => expect(publishRecipeVersion).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      managedRecipe.id,
      managedRecipeVersion.id,
      0,
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive recipe" }));
    await waitFor(() => expect(archiveRecipe).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      managedRecipe.id,
      0,
    ));
  });

  it("creates a next draft and retires an unused published version", async () => {
    vi.mocked(getCurrentAuthSession).mockResolvedValue({
      accessToken: "staff-token", email: "owner@example.test",
    });
    vi.mocked(getStaffContext).mockResolvedValue({
      accountId: "35f942a3-0591-4973-83ef-8889f608184e",
      memberships: [{
        organizationId: "88b23060-cbc4-4218-9938-63d75f6f324c",
        organizationName: "Bubble Tea Operations",
        role: "OWNER",
        locations: [],
      }],
    });
    const publishedVersion = {
      ...managedRecipeVersion,
      status: "PUBLISHED" as const,
      version: 2,
      publishedAt: "2026-08-22T01:00:00Z",
    };
    vi.mocked(getRecipe).mockResolvedValue({ ...managedRecipe, versions: [publishedVersion] });
    render(
      <MemoryRouter initialEntries={[
        `/staff/catalog/recipes/${managedRecipe.id}?organizationId=88b23060-cbc4-4218-9938-63d75f6f324c`,
      ]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 1, name: "Classic Milk Tea" });
    fireEvent.click(screen.getByRole("button", { name: "New draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Create next draft" }));
    await waitFor(() => expect(createRecipeVersion).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      managedRecipe.id,
      0,
    ));

    fireEvent.click(await screen.findByRole("button", { name: "Retire" }));
    fireEvent.click(screen.getByRole("button", { name: "Retire version" }));
    await waitFor(() => expect(retireRecipeVersion).toHaveBeenCalledWith(
      "staff-token",
      "88b23060-cbc4-4218-9938-63d75f6f324c",
      managedRecipe.id,
      managedRecipeVersion.id,
      2,
    ));
  });

  it("keeps a configured guest drink through to the current order", async () => {
    render(
      <MemoryRouter initialEntries={["/shop/drinks/moonlit-milk-tea"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Moonlit Milk Tea" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Pearls +$0.60" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to order · $7.20" }));
    scrollToMock.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "View order" }));

    expect(screen.getByRole("heading", { level: 1, name: "Your current order" })).toBeVisible();
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    expect(screen.getByText("Medium · 50% · Less ice · Pearls")).toBeVisible();
    expect(screen.getByText("Preview total").nextSibling).toHaveTextContent("$7.20");
  });
});
