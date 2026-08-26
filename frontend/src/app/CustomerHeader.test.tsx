import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartProvider } from "../features/cart/CartProvider";
import { useCart } from "../features/cart/CartContext";
import { expectNoAccessibilityViolations } from "../test/accessibility";
import { CustomerHeader } from "./CustomerHeader";

const authState = vi.hoisted(() => ({
  isLoading: false,
  session: null as null | { accessToken: string; email: string },
}));

vi.mock("../features/auth/useAuth", () => ({ useAuth: () => authState }));

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
  beforeEach(() => {
    authState.isLoading = false;
    authState.session = null;
  });

  it("uses compact cart and profile actions without a redundant menu tab", () => {
    render(
      <MemoryRouter>
        <CartProvider><HeaderHarness /></CartProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Current order, empty" })).toBeVisible();
    expect(screen.queryByText("0", { selector: "[data-slot='cart-count']" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guest account menu" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Add test drink" }));
    expect(screen.getByRole("link", { name: "Current order, 1 item" })).toBeVisible();
    expect(screen.getByText("1", { selector: "[data-slot='cart-count']" })).toBeVisible();
  });

  it("offers account access from the guest profile menu", async () => {
    render(
      <MemoryRouter>
        <CartProvider><CustomerHeader /></CartProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Guest account menu" }));

    expect(screen.getByText("Guest")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/account/access?mode=sign-in",
    );
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/account/access?mode=create",
    );
    await expectNoAccessibilityViolations(document.body);
  });

  it("links signed-in customers to their account from the profile menu", () => {
    authState.session = { accessToken: "customer-token", email: "customer@example.test" };

    render(
      <MemoryRouter>
        <CartProvider><CustomerHeader /></CartProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Account menu for customer@example.test" }));

    expect(screen.getByText("customer@example.test")).toBeVisible();
    expect(screen.getByRole("link", { name: "View account" })).toHaveAttribute("href", "/account");
  });
});
