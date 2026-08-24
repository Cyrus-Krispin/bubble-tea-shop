import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAccessibilityViolations } from "../../test/accessibility";
import { AuthContext } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { CartProvider } from "../cart/CartProvider";
import { getLatestCustomerReorder } from "./customerOrderClient";
import { LastOrderSuggestion } from "./LastOrderSuggestion";

vi.mock("./customerOrderClient", () => ({ getLatestCustomerReorder: vi.fn() }));

const latestSuggestion = {
  orderId: "c3d362dd-3552-4602-a981-bac11649eab0",
  publicOrderNumber: "BT0000000042",
  currencyCode: "SGD",
  totalMinor: 2090,
  createdAt: "2026-08-22T09:30:00Z",
  location: {
    id: "20000000-0000-0000-0000-000000000001",
    slug: "orchard-central",
    name: "Orchard Central",
  },
  items: [
    {
      productSlug: "moonlit-milk-tea",
      productName: "Moonlit Milk Tea",
      variantId: "50000000-0000-0000-0000-000000000002",
      variantName: "Medium",
      quantity: 2,
      unitPriceMinor: 720,
      selections: [
        {
          groupId: "70000000-0000-0000-0000-000000000001",
          groupName: "Sweetness",
          choiceIds: ["71000000-0000-0000-0000-000000000003"],
          choiceNames: ["50%"],
        },
        {
          groupId: "70000000-0000-0000-0000-000000000003",
          groupName: "Toppings",
          choiceIds: ["71000000-0000-0000-0000-000000000010"],
          choiceNames: ["Pearls"],
        },
      ],
    },
    {
      productSlug: "roasted-hojicha-latte",
      productName: "Roasted Hojicha Latte",
      variantId: "50000000-0000-0000-0000-000000000022",
      variantName: "Large",
      quantity: 1,
      unitPriceMinor: 650,
      selections: [],
    },
  ],
};

const catalogProducts = latestSuggestion.items.map((item, index) => ({
  id: `product-${index}`,
  slug: item.productSlug,
  name: item.productName,
  description: `${item.productName} description`,
  category: "Tea latte",
  artworkKey: item.productSlug,
  startingPrice: { amountMinor: item.unitPriceMinor, currency: "SGD" },
  available: true,
}));

function CartCount() {
  const { itemCount, items } = useCart();
  return (
    <>
      <output aria-label="Cart item count">{itemCount}</output>
      <output aria-label="Cart item names">{items.map((item) => item.drinkName).join(", ")}</output>
      <output aria-label="Cart item details">{items.map((item) => JSON.stringify({
        quantity: item.quantity,
        variantName: item.configuration.variantName,
        selections: item.configuration.selections,
        unitPriceMinor: item.unitPriceMinor,
      })).join(", ")}</output>
    </>
  );
}

function ConflictingCartSeed() {
  const { addItem } = useCart();
  return (
    <button onClick={() => addItem({
      locationSlug: "tiong-bahru",
      drinkId: "other-drink",
      drinkName: "Other drink",
      configuration: { variantId: "other-variant", variantName: "Medium", selections: [] },
      unitPriceMinor: 500,
      currency: "SGD",
    })} type="button">
      Seed conflicting cart
    </button>
  );
}

function renderSuggestion(
  session: { accessToken: string; email: string } | null,
  { seedConflict = false }: { seedConflict?: boolean } = {},
) {
  return render(
    <AuthContext.Provider value={{ isLoading: false, session }}>
      <MemoryRouter>
        <CartProvider>
          <LastOrderSuggestion locationSlug="orchard-central" products={catalogProducts} />
          <CartCount />
          {seedConflict ? <ConflictingCartSeed /> : null}
        </CartProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("LastOrderSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLatestCustomerReorder).mockResolvedValue(latestSuggestion);
  });

  it("shows saved drinks as selected quick-add choices and adds only the chosen lines", async () => {
    const { container } = renderSuggestion({
      accessToken: "customer-token",
      email: "customer@example.test",
    });

    expect(await screen.findByRole("heading", { name: "Order again" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Moonlit Milk Tea" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Roasted Hojicha Latte" })).toBeVisible();
    expect(screen.getByText("Medium · 50% · Pearls")).toBeVisible();
    expect(screen.queryByText("Current total")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(getLatestCustomerReorder).toHaveBeenCalledWith(
      "customer-token",
      "orchard-central",
      expect.any(AbortSignal),
    );

    const milkTea = screen.getByRole("checkbox", {
      name: "Select 2 Moonlit Milk Tea, Medium, 50%, Pearls",
    });
    const hojicha = screen.getByRole("checkbox", {
      name: "Select 1 Roasted Hojicha Latte, Large",
    });
    expect(milkTea).toBeChecked();
    expect(hojicha).toBeChecked();

    fireEvent.click(milkTea);
    fireEvent.click(screen.getByRole("button", { name: "Add 1 drink · $6.50" }));
    expect(screen.getByText("Added 1 drink to your order.")).toHaveAttribute("role", "status");
    expect(screen.getByRole("status", { name: "Cart item count" })).toHaveTextContent("1");
    expect(screen.getByRole("status", { name: "Cart item names" })).toHaveTextContent(
      "Roasted Hojicha Latte",
    );
    expect(screen.getByRole("status", { name: "Cart item details" })).toHaveTextContent(
      '"quantity":1,"variantName":"Large","selections":[],"unitPriceMinor":650',
    );
    await expectNoAccessibilityViolations(container);
  });

  it("disables quick add until at least one saved drink is selected", async () => {
    renderSuggestion({ accessToken: "customer-token", email: "customer@example.test" });

    fireEvent.click(await screen.findByRole("checkbox", {
      name: "Select 2 Moonlit Milk Tea, Medium, 50%, Pearls",
    }));
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Select 1 Roasted Hojicha Latte, Large",
    }));

    expect(screen.getByRole("button", { name: "Select drinks to add" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Cart item count" })).toHaveTextContent("0");
  });

  it("keeps a conflicting cart unchanged when selected drinks cannot be added", async () => {
    renderSuggestion(
      { accessToken: "customer-token", email: "customer@example.test" },
      { seedConflict: true },
    );

    await screen.findByRole("heading", { name: "Order again" });
    fireEvent.click(screen.getByRole("button", { name: "Seed conflicting cart" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 3 drinks · $20.90" }));

    expect(screen.getByText("Your cart can’t fit these drinks. Clear it before trying again."))
      .toHaveAttribute("role", "status");
    expect(screen.getByRole("status", { name: "Cart item count" })).toHaveTextContent("1");
    expect(screen.getByRole("status", { name: "Cart item names" })).toHaveTextContent("Other drink");
  });

  it("is hidden for guests and customers without an eligible latest order", async () => {
    const { rerender } = renderSuggestion(null);
    expect(screen.queryByRole("heading", { name: "Order again" })).not.toBeInTheDocument();
    expect(getLatestCustomerReorder).not.toHaveBeenCalled();

    vi.mocked(getLatestCustomerReorder).mockResolvedValueOnce(undefined);
    rerender(
      <AuthContext.Provider value={{
        isLoading: false,
        session: { accessToken: "customer-token", email: "customer@example.test" },
      }}>
        <MemoryRouter>
          <CartProvider>
            <LastOrderSuggestion locationSlug="orchard-central" products={catalogProducts} />
          </CartProvider>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(getLatestCustomerReorder).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Order again" })).not.toBeInTheDocument();
  });

  it("keeps a recoverable personalization error separate from the menu", async () => {
    vi.mocked(getLatestCustomerReorder).mockRejectedValueOnce(new Error("offline"));
    renderSuggestion({ accessToken: "customer-token", email: "customer@example.test" });

    expect(await screen.findByText("We couldn’t load your last order.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(getLatestCustomerReorder).toHaveBeenCalledTimes(2);
  });
});
