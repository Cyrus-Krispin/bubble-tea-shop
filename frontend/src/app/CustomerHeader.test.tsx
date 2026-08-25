import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { CartProvider } from "../features/cart/CartProvider";
import { useCart } from "../features/cart/CartContext";
import { CustomerHeader } from "./CustomerHeader";

vi.mock("../features/auth/useAuth", () => ({
  useAuth: () => ({ isLoading: false, session: null }),
}));

function HeaderHarness() {
  const { addItem } = useCart();
  return (
    <>
      <CustomerHeader />
      <button onClick={() => addItem({
        locationSlug: "orchard-central",
        drinkId: "moonlit-milk-tea",
        drinkName: "Moonlit Milk Tea",
        configuration: { variantId: "medium", variantName: "Medium", selections: [] },
        unitPriceMinor: 660,
        currency: "SGD",
      })} type="button">Add test drink</button>
    </>
  );
}

describe("CustomerHeader", () => {
  it("keeps the current cart count on every customer route", () => {
    render(
      <MemoryRouter>
        <CartProvider><HeaderHarness /></CartProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Order 0 items" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add test drink" }));
    expect(screen.getByRole("link", { name: "Order 1 item" })).toBeVisible();
  });
});
