import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CustomerOrderError,
  getCustomerOrder,
  getLatestCustomerReorder,
  listCustomerOrders,
} from "./customerOrderClient";

const summary = {
  id: "c3d362dd-3552-4602-a981-bac11649eab0",
  publicOrderNumber: "BT0000000042",
  status: "COMPLETED",
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
};

const detail = {
  id: summary.id,
  publicOrderNumber: summary.publicOrderNumber,
  status: summary.status,
  paymentMethod: summary.paymentMethod,
  currencyCode: summary.currencyCode,
  subtotalMinor: 720,
  totalMinor: summary.totalMinor,
  createdAt: summary.createdAt,
  completedAt: summary.completedAt,
  cancelledAt: summary.cancelledAt,
  location: summary.location,
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

const reorderSuggestion = {
  orderId: summary.id,
  publicOrderNumber: summary.publicOrderNumber,
  createdAt: summary.createdAt,
  location: summary.location,
  currencyCode: "SGD",
  totalMinor: 1440,
  items: [{
    productSlug: "moonlit-milk-tea",
    productName: "Moonlit Milk Tea",
    variantId: "50000000-0000-0000-0000-000000000002",
    variantName: "Medium",
    quantity: 2,
    unitPriceMinor: 720,
    selections: [{
      groupId: "70000000-0000-0000-0000-000000000001",
      groupName: "Sweetness",
      choiceIds: ["71000000-0000-0000-0000-000000000003"],
      choiceNames: ["50%"],
    }],
  }],
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("customerOrderClient", () => {
  it("loads a bounded customer page with bearer authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [summary], page: 0, size: 10, totalItems: 1, totalPages: 1,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCustomerOrders("customer-token", { page: 0, size: 10 }))
      .resolves.toMatchObject({ items: [summary], totalItems: 1 });

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.headers.get("authorization")).toBe("Bearer customer-token");
    const url = new URL(request.url);
    expect(url.pathname).toBe("/api/v1/customer/orders");
    expect(url.searchParams.get("page")).toBe("0");
    expect(url.searchParams.get("size")).toBe("10");
  });

  it("loads one owned immutable receipt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(detail), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCustomerOrder("customer-token", summary.id))
      .resolves.toMatchObject(detail);

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe(`/api/v1/customer/orders/${summary.id}`);
  });

  it("loads a current cart-ready reorder and maps no-content to no suggestion", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(reorderSuggestion), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLatestCustomerReorder("customer-token", "orchard-central"))
      .resolves.toEqual(reorderSuggestion);
    await expect(getLatestCustomerReorder("customer-token", "orchard-central"))
      .resolves.toBeUndefined();

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    const url = new URL(request.url);
    expect(url.pathname).toBe("/api/v1/customer/orders/latest-reorder");
    expect(url.searchParams.get("locationSlug")).toBe("orchard-central");
    expect(request.headers.get("authorization")).toBe("Bearer customer-token");
  });

  it("preserves safe problem codes and rejects malformed successful payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "CUSTOMER_ORDER_NOT_FOUND",
    }), { status: 404, headers: { "Content-Type": "application/problem+json" } })));

    await expect(getCustomerOrder("customer-token", summary.id)).rejects.toEqual(
      new CustomerOrderError("CUSTOMER_ORDER_NOT_FOUND", 404),
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ ...summary, totalMinor: "720" }],
      page: 0,
      size: 10,
      totalItems: 1,
      totalPages: 1,
    }), { status: 200 })));

    await expect(listCustomerOrders("customer-token", { page: 0, size: 10 }))
      .rejects.toThrow("invalid customer order response");
  });
});
