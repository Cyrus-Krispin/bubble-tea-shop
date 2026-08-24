import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderError, placeGuestOrder } from "./orderClient";

const response = {
  id: "order-id",
  publicOrderNumber: "BT0000000001",
  status: "PENDING",
  paymentMethod: "CASH",
  currencyCode: "SGD",
  subtotalMinor: 720,
  totalMinor: 720,
  createdAt: "2026-08-22T00:00:00Z",
  replayed: false,
  items: [
    {
      productName: "Moonlit Milk Tea",
      variantName: "Medium",
      quantity: 1,
      unitPriceMinor: 720,
      lineTotalMinor: 720,
      options: [
        { groupName: "Toppings", choiceName: "Pearls", priceDeltaMinor: 60 },
      ],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("orderClient", () => {
  it("submits only catalog identifiers and quantities with retry and optional auth headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      items: [
        {
          variantId: "variant-id",
          quantity: 1,
          optionChoiceIds: ["choice-id"],
        },
      ],
    };

    await expect(
      placeGuestOrder(body, "retry-key", "customer-token"),
    ).resolves.toEqual(response);

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.method).toBe("POST");
    expect(request.headers.get("idempotency-key")).toBe("retry-key");
    expect(request.headers.get("authorization")).toBe("Bearer customer-token");
    expect(await request.clone().json()).toEqual(body);
  });

  it("rejects malformed successful snapshots", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...response, totalMinor: "720" }), {
            status: 201,
          }),
        ),
    );
    await expect(placeGuestOrder({ items: [] }, "key")).rejects.toThrow(
      "invalid order response",
    );
  });

  it("submits an order through the selected location route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await placeGuestOrder({ items: [] }, "key", undefined, "tiong-bahru");

    expect((fetchMock.mock.calls[0]?.[0] as Request).url)
      .toBe("http://localhost:3000/api/v1/guest/locations/tiong-bahru/orders");
  });

  it("preserves stable order problem codes and status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "ORDER_CATALOG_CHANGED",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );
    await expect(placeGuestOrder({ items: [] }, "key")).rejects.toEqual(
      new OrderError("ORDER_CATALOG_CHANGED", 409),
    );
  });
});
