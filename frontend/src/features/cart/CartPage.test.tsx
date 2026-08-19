import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { CartProvider } from "./CartProvider";
import { useCart } from "./CartContext";
import { CartPage } from "./CartPage";

function SeedControl() {
  const { addItem } = useCart();
  return (
    <button onClick={() => addItem({
      drinkId: "moonlit-milk-tea",
      drinkName: "Moonlit Milk Tea",
      configuration: {
        variantId: "medium",
        variantName: "Medium",
        selections: [
          { groupId: "sweetness", groupName: "Sweetness", choiceIds: ["sweet-50"], choiceNames: ["50%"] },
          { groupId: "ice", groupName: "Ice", choiceIds: ["less-ice"], choiceNames: ["Less ice"] },
          { groupId: "toppings", groupName: "Toppings", choiceIds: ["pearls"], choiceNames: ["Pearls"] },
        ],
      },
      unitPriceMinor: 720,
      currency: "SGD",
    })} type="button">Seed item</button>
  );
}

function renderCart() {
  render(
    <MemoryRouter>
      <CartProvider><SeedControl /><CartPage /></CartProvider>
    </MemoryRouter>,
  );
}

describe("CartPage", () => {
  it("offers a route back to the menu when the order is empty", () => {
    renderCart();

    expect(screen.getByRole("heading", { name: "Your current order" })).toBeVisible();
    expect(screen.getByText("Your cup is waiting")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse the menu" })).toHaveAttribute("href", "/shop");
  });

  it("reviews items, updates quantity, and removes a line", () => {
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Seed item" }));

    expect(screen.getByRole("heading", { name: "Moonlit Milk Tea" })).toBeVisible();
    expect(screen.getByText("Medium · 50% · Less ice · Pearls")).toBeVisible();
    expect(screen.getByText("Preview total").nextSibling).toHaveTextContent("$7.20");

    fireEvent.click(screen.getByRole("button", { name: "Increase Moonlit Milk Tea quantity" }));
    expect(screen.getByText("Quantity 2")).toBeVisible();
    expect(screen.getByText("Preview total").nextSibling).toHaveTextContent("$14.40");

    fireEvent.click(screen.getByRole("button", { name: "Remove Moonlit Milk Tea" }));
    expect(screen.getByText("Your cup is waiting")).toBeVisible();
  });
});
