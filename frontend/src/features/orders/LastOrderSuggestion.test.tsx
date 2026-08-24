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
  totalMinor: 1440,
  createdAt: "2026-08-22T09:30:00Z",
  location: {
    id: "20000000-0000-0000-0000-000000000001",
    slug: "orchard-central",
    name: "Orchard Central",
  },
  items: [{
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
  }],
};

function CartCount() {
  const { itemCount } = useCart();
  return <output aria-label="Cart item count">{itemCount}</output>;
}

function renderSuggestion(session: { accessToken: string; email: string } | null) {
  return render(
    <AuthContext.Provider value={{ isLoading: false, session }}>
      <MemoryRouter>
        <CartProvider>
          <LastOrderSuggestion locationSlug="orchard-central" />
          <CartCount />
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

  it("shows the exact newest order and restores it to the cart", async () => {
    const { container } = renderSuggestion({
      accessToken: "customer-token",
      email: "customer@example.test",
    });

    expect(await screen.findByRole("heading", { name: "Order again" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "2 × Moonlit Milk Tea" })).toBeVisible();
    expect(screen.getByText("Medium · 50% · Pearls")).toBeVisible();
    expect(screen.getByText("Orchard Central")).toBeVisible();
    expect(screen.getByRole("link", { name: "View last order" })).toHaveAttribute(
      "href",
      `/account/orders/${latestSuggestion.orderId}`,
    );
    expect(getLatestCustomerReorder).toHaveBeenCalledWith(
      "customer-token",
      "orchard-central",
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add order to cart" }));
    expect(screen.getByText("Added your last order to the cart.")).toHaveAttribute("role", "status");
    expect(screen.getByRole("status", { name: "Cart item count" })).toHaveTextContent("2");
    await expectNoAccessibilityViolations(container);
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
          <CartProvider><LastOrderSuggestion locationSlug="orchard-central" /></CartProvider>
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
