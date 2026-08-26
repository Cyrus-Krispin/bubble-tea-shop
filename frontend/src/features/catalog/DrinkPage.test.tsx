import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogProduct } from "../../test/catalogFixtures";
import { CartProvider } from "../cart/CartProvider";
import { getGuestProduct } from "./catalogClient";
import { DrinkPage } from "./DrinkPage";

vi.mock("./catalogClient", () => ({
  getGuestLocations: vi.fn(),
  getGuestMenu: vi.fn(),
  getGuestProduct: vi.fn(),
}));

function renderDrink(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <Routes><Route path="/shop/:locationSlug/drinks/:drinkId" element={<DrinkPage />} /></Routes>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe("DrinkPage", () => {
  beforeEach(() => vi.mocked(getGuestProduct).mockResolvedValue(catalogProduct));

  it("updates the API-backed preview total and adds the configured drink", async () => {
    renderDrink("/shop/orchard-central/drinks/moonlit-milk-tea");

    await screen.findByRole("heading", { name: "Moonlit Milk Tea" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Pearls +$0.60" }));

    fireEvent.click(screen.getByRole("button", { name: "Add to order · $7.20" }));

    expect(screen.getByRole("status")).toHaveTextContent("Added Moonlit Milk Tea to your order.");
    expect(screen.getByRole("link", { name: "Current order, 1 item" })).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: "Small −$0.50" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers retry and a route back when a drink cannot be loaded", async () => {
    vi.mocked(getGuestProduct).mockRejectedValueOnce(new Error("missing"));
    renderDrink("/shop/orchard-central/drinks/not-a-drink");

    expect(await screen.findByRole("heading", { name: /We couldn’t find that drink/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to menu" })).toHaveAttribute("href", "/shop/orchard-central");
  });
});
