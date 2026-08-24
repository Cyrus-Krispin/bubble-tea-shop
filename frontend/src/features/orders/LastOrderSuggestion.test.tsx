import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../auth/AuthContext";
import { listCustomerOrders } from "./customerOrderClient";
import { LastOrderSuggestion } from "./LastOrderSuggestion";

vi.mock("./customerOrderClient", () => ({ listCustomerOrders: vi.fn() }));

const latestPage = {
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
  size: 1,
  totalItems: 1,
  totalPages: 1,
};

function renderSuggestion(session: { accessToken: string; email: string } | null) {
  return render(
    <AuthContext.Provider value={{ isLoading: false, session }}>
      <MemoryRouter><LastOrderSuggestion /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("LastOrderSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCustomerOrders).mockResolvedValue(latestPage);
  });

  it("shows the newest account-linked order for a signed-in customer", async () => {
    renderSuggestion({ accessToken: "customer-token", email: "customer@example.test" });

    expect(await screen.findByRole("heading", { name: "Last ordered" })).toBeVisible();
    expect(screen.getByText("Moonlit Milk Tea · Medium")).toBeVisible();
    expect(screen.getByText("Orchard Central")).toBeVisible();
    expect(screen.getByRole("link", { name: "View last order" })).toHaveAttribute(
      "href",
      `/account/orders/${latestPage.items[0].id}`,
    );
    expect(listCustomerOrders).toHaveBeenCalledWith(
      "customer-token",
      { page: 0, size: 1 },
      expect.any(AbortSignal),
    );
  });

  it("is hidden for guests and customers without history", async () => {
    const { rerender } = renderSuggestion(null);
    expect(screen.queryByRole("heading", { name: "Last ordered" })).not.toBeInTheDocument();
    expect(listCustomerOrders).not.toHaveBeenCalled();

    vi.mocked(listCustomerOrders).mockResolvedValueOnce({
      items: [], page: 0, size: 1, totalItems: 0, totalPages: 0,
    });
    rerender(
      <AuthContext.Provider value={{
        isLoading: false,
        session: { accessToken: "customer-token", email: "customer@example.test" },
      }}>
        <MemoryRouter><LastOrderSuggestion /></MemoryRouter>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(listCustomerOrders).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Last ordered" })).not.toBeInTheDocument();
  });

  it("keeps a recoverable personalization error separate from the menu", async () => {
    vi.mocked(listCustomerOrders).mockRejectedValueOnce(new Error("offline"));
    renderSuggestion({ accessToken: "customer-token", email: "customer@example.test" });

    expect(await screen.findByText("We couldn’t load your last order.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(listCustomerOrders).toHaveBeenCalledTimes(2);
  });
});
