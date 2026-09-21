import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { selectOption } from "../../test/selectOption";
import { CustomerFavoritePanel } from "./CustomerFavoritePanel";
import { getFavorite, saveFavorite } from "./favoriteClient";
vi.mock("../catalog/useGuestCatalog", () => ({ useGuestLocations: () => ({ status: "ready", data: [{ id: "loc", slug: "shop", name: "Shop", currency: "SGD" }] }) }));
vi.mock("./favoriteClient", () => ({ getFavorite: vi.fn(), saveFavorite: vi.fn() }));
const empty = { recipeId: null, recipeName: null, recipes: [{ id: "recipe", name: "Tea recipe" }], discountPercent: 5 };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getFavorite).mockResolvedValue(empty); });
it("selects and removes the customer's API-backed favorite", async () => {
  vi.mocked(saveFavorite).mockResolvedValueOnce({ ...empty, recipeId: "recipe", recipeName: "Tea recipe" }).mockResolvedValueOnce(empty);
  render(<CustomerFavoritePanel accessToken="token" />);
  await screen.findByText("You have not chosen a favorite yet.");
  await selectOption(screen.getByRole("combobox", { name: "Favorite recipe" }), "Tea recipe");
  fireEvent.click(screen.getByRole("button", { name: "Save favorite" }));
  expect(await screen.findByText("Current favorite: Tea recipe")).toBeVisible();
  expect(saveFavorite).toHaveBeenCalledWith("token", "shop", "recipe");
  fireEvent.click(screen.getByRole("button", { name: "Remove favorite" }));
  expect(await screen.findByText("You have not chosen a favorite yet.")).toBeVisible();
  expect(saveFavorite).toHaveBeenLastCalledWith("token", "shop", null);
});
it("keeps a clear error when favorites are unavailable", async () => {
  vi.mocked(getFavorite).mockRejectedValue(new Error("unavailable"));
  render(<CustomerFavoritePanel accessToken="token" />);
  expect(await screen.findByText("Favorite unavailable")).toBeVisible();
});

it("ignores a stale favorite refresh after saving a newer selection", async () => {
  let resolveRefresh!: (value: typeof empty) => void;
  vi.mocked(getFavorite).mockResolvedValueOnce(empty).mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
  vi.mocked(saveFavorite).mockResolvedValue({ ...empty, recipeId: "recipe", recipeName: "Tea recipe" });
  render(<CustomerFavoritePanel accessToken="token" />);
  await screen.findByText("You have not chosen a favorite yet.");
  fireEvent.click(screen.getByRole("button", { name: "Refresh favorite" }));
  await selectOption(screen.getByRole("combobox", { name: "Favorite recipe" }), "Tea recipe");
  fireEvent.click(screen.getByRole("button", { name: "Save favorite" }));
  await screen.findByText("Current favorite: Tea recipe");
  await act(async () => { resolveRefresh(empty); });
  expect(screen.getByText("Current favorite: Tea recipe")).toBeVisible();
});
