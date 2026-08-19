import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { CartProvider } from "../cart/CartProvider";
import { DrinkPage } from "./DrinkPage";

function renderDrink(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <Routes><Route path="/shop/drinks/:drinkId" element={<DrinkPage />} /></Routes>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe("DrinkPage", () => {
  it("updates the preview total and adds the configured drink", () => {
    renderDrink("/shop/drinks/moonlit-milk-tea");

    fireEvent.click(screen.getByRole("radio", { name: "Large +$0.80" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pearls +$0.60" }));

    fireEvent.click(screen.getByRole("button", { name: "Add to order · $8.00" }));

    expect(screen.getByRole("status")).toHaveTextContent("Added Moonlit Milk Tea to your order.");
    expect(screen.getByRole("link", { name: "Order 1 items" })).toBeVisible();
  });

  it("offers a route back to the menu for an unknown drink", () => {
    renderDrink("/shop/drinks/not-a-drink");

    expect(screen.getByRole("heading", { name: "We couldn't find that drink" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to menu" })).toHaveAttribute("href", "/shop");
  });
});
