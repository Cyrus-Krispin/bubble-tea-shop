import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAccessibilityViolations } from "../../test/accessibility";
vi.mock("./orderClient", () => ({
  placeGuestOrder: vi.fn(),
  OrderError: class OrderError extends Error {
    constructor(public code: string, public status: number) {
      super(code);
    }
  },
}));

import { CartProvider } from "./CartProvider";
import { useCart } from "./CartContext";
import { CartPage } from "./CartPage";
import { placeGuestOrder } from "./orderClient";

const placedOrder = {
  id: "order-id",
  publicOrderNumber: "BT0000000001",
  status: "PENDING",
  paymentMethod: "CASH",
  currencyCode: "SGD",
  subtotalMinor: 720,
  totalMinor: 720,
  createdAt: "2026-08-22T00:00:00Z",
  replayed: false,
  items: [{
    productName: "Moonlit Milk Tea",
    variantName: "Medium",
    quantity: 1,
    unitPriceMinor: 720,
    lineTotalMinor: 720,
    options: [],
  }],
};

function SeedControl() {
  const { addItem } = useCart();
  return (
    <button onClick={() => addItem({
      locationSlug: "orchard-central",
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
  return render(
    <MemoryRouter>
      <CartProvider><SeedControl /><CartPage /></CartProvider>
    </MemoryRouter>,
  );
}

describe("CartPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(placeGuestOrder).mockResolvedValue(placedOrder);
  });

  it("offers a route back to the menu when the order is empty", () => {
    renderCart();

    expect(screen.getByRole("heading", { name: "Your current order" })).toBeVisible();
    expect(screen.getByText("Your cup is waiting")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse the menu" })).toHaveAttribute("href", "/shop");
  });

  it("reviews items, updates quantity, and removes a line", async () => {
    const { container } = renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Seed item" }));

    expect(screen.getByRole("heading", { name: "Moonlit Milk Tea" })).toBeVisible();
    await expectNoAccessibilityViolations(container);
    expect(screen.getByText("Medium · 50% · Less ice · Pearls")).toBeVisible();
    expect(screen.getByText("Preview total").nextSibling).toHaveTextContent("$7.20");

    fireEvent.click(screen.getByRole("button", { name: "Increase Moonlit Milk Tea quantity" }));
    expect(screen.getByText("Quantity 2")).toBeVisible();
    expect(screen.getByText("Preview total").nextSibling).toHaveTextContent("$14.40");

    fireEvent.click(screen.getByRole("button", { name: "Remove Moonlit Milk Tea" }));
    expect(screen.getByText("Your cup is waiting")).toBeVisible();
  });

  it("submits catalog identifiers only and clears the cart after server confirmation", async () => {
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Seed item" }));
    fireEvent.click(screen.getByRole("button", { name: "Place cash order" }));

    await waitFor(() => expect(placeGuestOrder).toHaveBeenCalledWith({
      items: [{
        variantId: "medium",
        quantity: 1,
        optionChoiceIds: ["sweet-50", "less-ice", "pearls"],
      }],
    }, expect.any(String), undefined, "orchard-central"));
    expect(await screen.findByRole("heading", { name: "Pickup BT0000000001" })).toBeVisible();
    expect(screen.getByText("Confirmed total").nextSibling).toHaveTextContent("$7.20");
    expect(screen.queryByRole("heading", { name: "Moonlit Milk Tea" })).not.toBeInTheDocument();
  });

  it("reuses the same key after an ambiguous network failure and prevents duplicate clicks", async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    vi.mocked(placeGuestOrder)
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }))
      .mockRejectedValueOnce(new TypeError("network unavailable"));
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: "Seed item" }));
    const checkout = screen.getByRole("button", { name: "Place cash order" });
    fireEvent.click(checkout);
    expect(screen.getByRole("button", { name: "Placing order…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Placing order…" }));
    expect(placeGuestOrder).toHaveBeenCalledTimes(1);

    rejectRequest?.(new TypeError("network unavailable"));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn’t confirm");
    const firstKey = vi.mocked(placeGuestOrder).mock.calls[0]?.[1];
    fireEvent.click(screen.getByRole("button", { name: "Place cash order" }));
    await waitFor(() => expect(placeGuestOrder).toHaveBeenCalledTimes(2));
    expect(vi.mocked(placeGuestOrder).mock.calls[1]?.[1]).toBe(firstKey);
    expect(screen.getByRole("heading", { name: "Moonlit Milk Tea" })).toBeVisible();
  });
});
