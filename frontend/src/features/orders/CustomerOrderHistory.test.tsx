import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAccessibilityViolations } from "../../test/accessibility";
import { listCustomerOrders } from "./customerOrderClient";
import { CustomerOrderHistory } from "./CustomerOrderHistory";

vi.mock("./customerOrderClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("./customerOrderClient")>();
  return { ...original, listCustomerOrders: vi.fn() };
});

const page = {
  items: [{
    id: "c3d362dd-3552-4602-a981-bac11649eab0",
    publicOrderNumber: "BT0000000042",
    status: "COMPLETED" as const,
    paymentMethod: "CASH",
    currencyCode: "SGD",
    totalMinor: 720,
    itemQuantity: 1,
    createdAt: "2026-08-22T09:30:00Z",
    completedAt: "2026-08-22T09:35:00Z",
    cancelledAt: null,
    location: {
      id: "20000000-0000-0000-0000-000000000001",
      slug: "orchard-central",
      name: "Orchard Central",
    },
    items: [{ productName: "Moonlit Milk Tea", variantName: "Medium", quantity: 1 }],
  }],
  page: 0,
  size: 5,
  totalItems: 6,
  totalPages: 2,
};

describe("CustomerOrderHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCustomerOrders).mockResolvedValue(page);
  });

  it("shows newest-first snapshots with receipt navigation and pagination", async () => {
    const { container } = render(
      <MemoryRouter><CustomerOrderHistory accessToken="customer-token" /></MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Order history" })).toBeVisible();
    expect(screen.getByText("Moonlit Milk Tea · Medium")).toBeVisible();
    expect(screen.getByText("Completed")).toBeVisible();
    expect(screen.getByRole("link", { name: "View order BT0000000042" })).toHaveAttribute(
      "href",
      `/account/orders/${page.items[0].id}`,
    );
    await expectNoAccessibilityViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(listCustomerOrders).toHaveBeenLastCalledWith(
      "customer-token",
      { page: 1, size: 5 },
      expect.any(AbortSignal),
    );
  });

  it("shows meaningful empty and recoverable error states", async () => {
    vi.mocked(listCustomerOrders).mockResolvedValueOnce({
      items: [], page: 0, size: 5, totalItems: 0, totalPages: 0,
    });
    const { rerender } = render(
      <MemoryRouter><CustomerOrderHistory accessToken="customer-token" /></MemoryRouter>,
    );
    expect(await screen.findByText("No orders yet")).toBeVisible();

    vi.mocked(listCustomerOrders).mockRejectedValueOnce(new Error("offline"));
    rerender(<MemoryRouter><CustomerOrderHistory accessToken="new-token" /></MemoryRouter>);
    expect(await screen.findByText("We couldn’t load your order history.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(listCustomerOrders).toHaveBeenCalledTimes(3);
  });
});
