import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAccessibilityViolations } from "../../test/accessibility";
import { AuthContext } from "../auth/AuthContext";
import { getCustomerOrder } from "./customerOrderClient";
import { CustomerOrderDetailPage } from "./CustomerOrderDetailPage";

vi.mock("./customerOrderClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("./customerOrderClient")>();
  return { ...original, getCustomerOrder: vi.fn() };
});

const orderId = "c3d362dd-3552-4602-a981-bac11649eab0";
const detail = {
  id: orderId,
  publicOrderNumber: "BT0000000042",
  status: "COMPLETED" as const,
  paymentMethod: "CASH",
  currencyCode: "SGD",
  subtotalMinor: 720,
  totalMinor: 720,
  createdAt: "2026-08-22T09:30:00Z",
  completedAt: "2026-08-22T09:35:00Z",
  cancelledAt: null,
  location: {
    id: "20000000-0000-0000-0000-000000000001",
    slug: "orchard-central",
    name: "Orchard Central",
  },
  items: [{
    lineNumber: 1,
    productName: "Moonlit Milk Tea",
    variantName: "Medium",
    quantity: 1,
    unitPriceMinor: 720,
    lineTotalMinor: 720,
    options: [{
      selectionNumber: 1,
      groupName: "Toppings",
      choiceName: "Brown Sugar Pearls",
      priceDeltaMinor: 70,
    }],
  }],
};

function renderPage(session: { accessToken: string; email: string } | null) {
  return render(
    <AuthContext.Provider value={{ isLoading: false, session }}>
      <MemoryRouter initialEntries={[`/account/orders/${orderId}`]}>
        <Routes>
          <Route path="/account/orders/:orderId" element={<CustomerOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("CustomerOrderDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCustomerOrder).mockResolvedValue(detail);
  });

  it("renders an immutable, accessible customer receipt", async () => {
    const { container } = renderPage({
      accessToken: "customer-token",
      email: "customer@example.test",
    });

    expect(await screen.findByRole("heading", { name: "Order BT0000000042" })).toBeVisible();
    expect(screen.getByText("Moonlit Milk Tea")).toBeVisible();
    expect(screen.getByText("Medium · Brown Sugar Pearls")).toBeVisible();
    expect(screen.getAllByText("$7.20")[0]).toBeVisible();
    expect(screen.getByText("Completed")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to order history" })).toHaveAttribute(
      "href",
      "/account#order-history",
    );
    await expectNoAccessibilityViolations(container);
  });

  it("does not request a receipt for a signed-out visitor", () => {
    renderPage(null);
    expect(screen.getByRole("heading", { name: "Sign in to view this order" })).toBeVisible();
    expect(getCustomerOrder).not.toHaveBeenCalled();
  });
});
